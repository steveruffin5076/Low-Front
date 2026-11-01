"""
Helpers for building low-poly weapon models in Blender (bpy), in game coordinates:
meters, +Y up, the muzzle along -Z, +X the weapon's right side. Geometry is converted to
Blender's Z-up on output; the glTF exporter converts it back, so the game sees these numbers.

A model is a set of named parts. `body` holds the static geometry; other parts are moving
nodes (bolt, magazine, ...) with a pivot. Empties mark points (pt_<name>) and attachment
mounts (mount_<slot>). Material names are palette keys the game maps to its own materials.
"""
import math

import bpy  # noqa: I001  (bpy must load before bmesh and mathutils)
import bmesh
from mathutils import Matrix, Vector

# Game (x, y, z) -> Blender (x, -z, y).
TO_BLENDER = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# Preview colors only (renders); the game swaps every material for its own by name.
PREVIEW_COLORS = {
    "metal": (0.10, 0.11, 0.12),
    "polymer": (0.05, 0.05, 0.055),
    "interior": (0.02, 0.02, 0.025),
    "bolt": (0.45, 0.47, 0.5),
    "brass": (0.7, 0.5, 0.15),
    "tan": (0.55, 0.45, 0.3),
    "glass": (0.1, 0.25, 0.3),
    "dot": (1.0, 0.1, 0.05),
}


def _mat(name):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    c = PREVIEW_COLORS.get(name, (0.5, 0.5, 0.5))
    m.diffuse_color = (*c, 1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*c, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.6
    return m


class Part:
    """Geometry of one object, in game space, with a material per face."""

    def __init__(self, name, pivot=(0.0, 0.0, 0.0)):
        self.name = name
        self.pivot = Vector(pivot)
        self.bm = bmesh.new()
        self.materials = []

    def _mat_index(self, material):
        if material not in self.materials:
            self.materials.append(material)
        return self.materials.index(material)

    def _tag(self, start, material):
        self.bm.faces.ensure_lookup_table()
        idx = self._mat_index(material)
        for f in self.bm.faces[start:]:
            f.material_index = idx

    def _begin(self):
        self.bm.faces.ensure_lookup_table()
        return len(self.bm.faces)

    # --- Primitives (all in game space) ---

    def box(self, material, lo, hi, bevel=0.0):
        """Axis-aligned box between corners `lo` and `hi`; `bevel` chamfers its edges."""
        start = self._begin()
        size = [hi[i] - lo[i] for i in range(3)]
        center = [(hi[i] + lo[i]) / 2 for i in range(3)]
        m = Matrix.Translation(center) @ Matrix.Diagonal((*size, 1))
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        if bevel > 0:
            edges = list({e for v in res["verts"] for e in v.link_edges})
            bmesh.ops.bevel(self.bm, geom=edges, offset=min(bevel, min(size) * 0.45), segments=1, affect="EDGES", profile=0.5)
        self._tag(start, material)
        return self

    def box_at(self, material, size, pos, rot=(0.0, 0.0, 0.0)):
        """Box of `size` centered on `pos`, rotated by Euler XYZ `rot` (radians)."""
        start = self._begin()
        r = Matrix.Rotation(rot[2], 4, "Z") @ Matrix.Rotation(rot[1], 4, "Y") @ Matrix.Rotation(rot[0], 4, "X")
        m = Matrix.Translation(pos) @ r @ Matrix.Diagonal((*size, 1))
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        self._tag(start, material)
        return self

    def cyl(self, material, radius, length, pos, axis="z", segments=8, radius_end=None, rot_offset=0.0):
        """Cylinder (or cone) centered on `pos` along an axis. `radius_end` is the radius at the + end."""
        start = self._begin()
        r2 = radius if radius_end is None else radius_end
        # create_cone builds along its local Z, radius1 at -Z, radius2 at +Z.
        if axis == "z":
            align = Matrix.Identity(4)
        elif axis == "x":
            align = Matrix.Rotation(math.pi / 2, 4, "Y")
        else:
            align = Matrix.Rotation(-math.pi / 2, 4, "X")
        m = Matrix.Translation(pos) @ align @ Matrix.Rotation(rot_offset + math.pi / segments, 4, "Z")
        bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=r2, depth=length, matrix=m)
        self._tag(start, material)
        return self

    def cyl_z(self, material, radius, z0, z1, y, x=0.0, segments=8, radius_end=None):
        """Cylinder along Z from z0 to z1 (`radius_end` at the larger z)."""
        lo, hi = min(z0, z1), max(z0, z1)
        return self.cyl(material, radius, hi - lo, (x, y, (lo + hi) / 2), "z", segments, radius_end)

    def profile(self, material, points, thickness, center_x=0.0):
        """Side profile: (z, y) points seen from the right, extruded along X."""
        start = self._begin()
        half = thickness / 2
        verts = [self.bm.verts.new((center_x - half, y, z)) for z, y in points]
        face = self.bm.faces.new(verts)
        res = bmesh.ops.extrude_face_region(self.bm, geom=[face])
        moved = [g for g in res["geom"] if isinstance(g, bmesh.types.BMVert)]
        bmesh.ops.translate(self.bm, vec=(thickness, 0, 0), verts=moved)
        bmesh.ops.recalc_face_normals(self.bm, faces=list(self.bm.faces)[start:])
        self._tag(start, material)
        return self

    def section(self, material, points, z0, z1):
        """Cross-section: (x, y) points seen from the muzzle, extruded along Z from z0 to z1."""
        start = self._begin()
        verts = [self.bm.verts.new((x, y, z0)) for x, y in points]
        face = self.bm.faces.new(verts)
        res = bmesh.ops.extrude_face_region(self.bm, geom=[face])
        moved = [g for g in res["geom"] if isinstance(g, bmesh.types.BMVert)]
        bmesh.ops.translate(self.bm, vec=(0, 0, z1 - z0), verts=moved)
        bmesh.ops.recalc_face_normals(self.bm, faces=list(self.bm.faces)[start:])
        self._tag(start, material)
        return self

    def ring(self, material, center, outer, inner, z0, z1, segments=12):
        """Tube along Z (a sight hood or a ring mount): outer and inner radius."""
        start = self._begin()
        cx, cy = center
        rings = []
        for z in (z0, z1):
            o = [self.bm.verts.new((cx + math.cos(a) * outer, cy + math.sin(a) * outer, z)) for a in _angles(segments)]
            i = [self.bm.verts.new((cx + math.cos(a) * inner, cy + math.sin(a) * inner, z)) for a in _angles(segments)]
            rings.append((o, i))
        (o0, i0), (o1, i1) = rings
        n = segments
        for k in range(n):
            j = (k + 1) % n
            self.bm.faces.new((o0[k], o0[j], o1[j], o1[k]))
            self.bm.faces.new((i0[k], i1[k], i1[j], i0[j]))
            self.bm.faces.new((o0[k], i0[k], i0[j], o0[j]))
            self.bm.faces.new((o1[k], o1[j], i1[j], i1[k]))
        bmesh.ops.recalc_face_normals(self.bm, faces=list(self.bm.faces)[start:])
        self._tag(start, material)
        return self

    def triangles(self):
        return sum(len(f.verts) - 2 for f in self.bm.faces)


def _angles(n):
    return [2 * math.pi * k / n for k in range(n)]


class Model:
    """A weapon or attachment: parts, points and mounts, exported as one GLB."""

    def __init__(self, name):
        self.name = name
        self.parts = {}
        self.points = {}

    def part(self, name, pivot=(0.0, 0.0, 0.0)):
        if name not in self.parts:
            self.parts[name] = Part(name, pivot)
        return self.parts[name]

    @property
    def body(self):
        return self.part("body")

    def point(self, name, pos):
        self.points[name] = Vector(pos)
        return self

    def triangles(self):
        return sum(p.triangles() for p in self.parts.values())

    def build(self, collection):
        """Creates the Blender objects (Z-up) in `collection`."""
        for p in self.parts.values():
            if not p.bm.faces:
                continue
            bm = p.bm.copy()
            bmesh.ops.translate(bm, vec=-p.pivot, verts=bm.verts)
            bm.transform(TO_BLENDER)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            mesh = bpy.data.meshes.new(f"{self.name}_{p.name}")
            bm.to_mesh(mesh)
            bm.free()
            for name in p.materials:
                mesh.materials.append(_mat(name))
            for poly in mesh.polygons:
                poly.use_smooth = False
            obj = bpy.data.objects.new(p.name, mesh)
            obj.location = TO_BLENDER @ p.pivot
            collection.objects.link(obj)
        for name, pos in self.points.items():
            e = bpy.data.objects.new(name, None)
            e.empty_display_size = 0.01
            e.location = TO_BLENDER @ pos
            collection.objects.link(e)

    def export(self, path, preview=None):
        """Writes the GLB; with `preview`, also renders a side and a 3/4 view to that PNG path prefix."""
        reset_scene()
        col = bpy.data.collections.new(self.name)
        bpy.context.scene.collection.children.link(col)
        self.build(col)
        if preview:
            render_previews(preview)
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format="GLB",
            export_yup=True,
            export_apply=True,
            export_materials="EXPORT",
            export_normals=True,
            export_texcoords=False,
            export_attributes=False,
            export_animations=False,
            export_cameras=False,
            export_lights=False,
        )


def render_previews(prefix):
    """Side and 3/4 views with Cycles on the CPU (no GPU needed). Writes <prefix>-side.png and <prefix>-34.png."""
    sc = bpy.context.scene
    meshes = [o for o in sc.objects if o.type == "MESH"]
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    center = (lo + hi) / 2
    size = max((hi - lo).length, 0.05)
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 16
    sc.render.resolution_x, sc.render.resolution_y = 960, 540
    world = bpy.data.worlds.new("w")
    world.color = (0.55, 0.6, 0.66)
    sc.world = world
    for rot in ((0.9, 0.2, 0.6), (-0.5, -0.4, -2.4)):
        sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
        sun.data.energy = 3.0
        sun.rotation_euler = rot
        sc.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    # Blender axes: the muzzle points along +Y, up is +Z, the right side faces +X.
    views = {"side": Vector((1, 0, 0)), "34": Vector((0.8, 0.55, 0.45)).normalized()}
    for tag, d in views.items():
        cam.data.type = "ORTHO" if tag == "side" else "PERSP"
        cam.data.ortho_scale = size * 1.1
        cam.data.lens = 50
        cam.location = center + d * size * 2.2
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = f"{prefix}-{tag}.png"
        bpy.ops.render.render(write_still=True)
