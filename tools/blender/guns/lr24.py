"""
LR-24 bolt-action sniper rifle (fictional), ~1.1 m overall, 6x scope built in.
Same layout as the code-built model (origin of the drawing at the top of the pistol grip, muzzle
along -Z). Gunsmith extras: mounts at the muzzle (suppressor), under the forend (bipod) and at
the magazine.
"""
from kit import Model

BORE_Y = 0.055
REC = dict(z_rear=0.1, z_front=-0.12, radius=0.016)
MUZZLE_Z = -0.66
SCOPE_Y = BORE_Y + 0.05
SCOPE = dict(tube=0.013, z_front=-0.13, z_rear=0.12, objective=0.021, eyepiece=0.018)
BOLT_PIVOT = (0.0, BORE_Y, 0.06)
# Bolt knob relative to the pivot; the same numbers are in src/data/viewmodel.ts (lr24.bolt.knob).
BOLT_KNOB = (0.042, -0.012, 0.02)
MAGWELL = dict(z_rear=0.0, z_front=-0.06)
MAG_WELL_POINT = (0.0, 0.0, (MAGWELL["z_rear"] + MAGWELL["z_front"]) / 2)
BUTT_END = 0.44

POINTS = {
    "pt_muzzle": (0.0, BORE_Y, MUZZLE_Z),
    "pt_ejectionPort": (0.017, BORE_Y + 0.006, 0.0),
    "pt_sightAnchor": (0.0, SCOPE_Y, SCOPE["z_rear"] + 0.07 + 0.08),
    "pt_rightHandGrip": (0.0, -0.045, 0.04),
    "pt_leftHandGrip": (0.0, 0.0, -0.3),
    "pt_magWell": MAG_WELL_POINT,
    "mount_muzzle": (0.0, BORE_Y, MUZZLE_Z),
    "mount_underbarrel": (0.0, -0.003, -0.41),
    "mount_magazine": MAG_WELL_POINT,
}

GRIP_PROFILE = [(0.01, 0.01), (0.05, 0.01), (0.08, -0.085), (0.068, -0.096), (0.046, -0.094), (0.014, -0.015)]
FOREND = [(-0.12, 0.042), (-0.44, 0.042), (-0.45, 0.03), (-0.44, 0.0), (-0.12, -0.005)]
BED = [(0.1, 0.045), (-0.12, 0.045), (-0.12, -0.005), (0.1, -0.005)]
BUTT = [(0.1, 0.045), (0.16, 0.065), (BUTT_END, 0.065), (BUTT_END, -0.1), (BUTT_END - 0.025, -0.106), (0.2, -0.035), (0.12, -0.012), (0.1, -0.005)]


def models():
    return [("guns/lr24_fp", detailed()), ("guns/lr24_tp", simple())]


def add_points(m):
    for name, pos in POINTS.items():
        m.point(name, pos)


def magazine(m):
    mag = m.part("magazine", MAG_WELL_POINT)
    mag.box("metal", (-0.012, -0.03, MAGWELL["z_front"]), (0.012, 0.03, MAGWELL["z_rear"]), bevel=0.0015)
    return mag


def detailed():
    m = Model("lr24_fp")
    add_points(m)
    b = m.body
    r = REC

    # Round receiver with the ejection port, heavy tapered barrel, crowned muzzle.
    b.cyl_z("metal", r["radius"], r["z_front"], r["z_rear"], BORE_Y, segments=12)
    b.box("interior", (r["radius"] - 0.002, BORE_Y - 0.002, -0.03), (r["radius"] + 0.0005, BORE_Y + 0.012, 0.03))
    b.cyl("metal", 0.009, abs(MUZZLE_Z - r["z_front"]), (0.0, BORE_Y, (MUZZLE_Z + r["z_front"]) / 2), "z", segments=10, radius_end=0.013)
    b.cyl_z("interior", 0.004, MUZZLE_Z - 0.0005, MUZZLE_Z + 0.004, BORE_Y, segments=6)

    # Stock (forend, action bed, butt with a raised comb), pad, grip, trigger guard, sling studs.
    for pts, t in ((FOREND, 0.04), (BED, 0.038), (BUTT, 0.036), (GRIP_PROFILE, 0.03)):
        b.profile("green", pts, t)
    b.box("polymer", (-0.019, -0.106, BUTT_END), (0.019, 0.066, BUTT_END + 0.014), bevel=0.003)
    b.box("metal", (-0.006, -0.03, -0.075), (0.006, -0.025, 0.012))
    b.box("metal", (-0.006, -0.03, -0.08), (0.006, -0.005, -0.074))
    for z, y in ((-0.4, -0.008), (0.36, -0.095)):
        b.cyl("metal", 0.003, 0.012, (0.0, y, z), axis="y", segments=6)

    # Scope: rings, tube, objective and eyepiece bells, turrets, lenses.
    s = SCOPE
    for z in (-0.08, 0.06):
        b.box("metal", (-0.008, BORE_Y + r["radius"] - 0.003, z - 0.008), (0.008, SCOPE_Y - s["tube"] + 0.002, z + 0.008))
        b.cyl_z("metal", s["tube"] + 0.0025, z - 0.008, z + 0.008, SCOPE_Y, segments=12)
    b.cyl_z("metal", s["tube"], s["z_front"], s["z_rear"], SCOPE_Y, segments=12)
    b.cyl("metal", s["objective"], 0.04, (0.0, SCOPE_Y, s["z_front"] - 0.02), "z", segments=12, radius_end=s["tube"])
    b.cyl_z("metal", s["objective"], s["z_front"] - 0.04, s["z_front"] - 0.12, SCOPE_Y, segments=12)
    b.cyl("metal", s["tube"], 0.03, (0.0, SCOPE_Y, s["z_rear"] + 0.015), "z", segments=12, radius_end=s["eyepiece"])
    b.cyl_z("metal", s["eyepiece"], s["z_rear"] + 0.03, s["z_rear"] + 0.07, SCOPE_Y, segments=12)
    b.cyl("metal", 0.008, 0.02, (0.0, SCOPE_Y + s["tube"] + 0.008, -0.01), axis="y", segments=8)
    b.cyl("metal", 0.008, 0.02, (s["tube"] + 0.008, SCOPE_Y, -0.01), axis="x", segments=8)
    b.cyl_z("glass", s["objective"] - 0.002, s["z_front"] - 0.1205, s["z_front"] - 0.118, SCOPE_Y, segments=12)
    b.cyl_z("glass", s["eyepiece"] - 0.002, s["z_rear"] + 0.068, s["z_rear"] + 0.0705, SCOPE_Y, segments=12)

    # --- Moving parts ---
    px, py, pz = BOLT_PIVOT
    kx, ky, kz = BOLT_KNOB
    bolt = m.part("bolt", BOLT_PIVOT)
    bolt.cyl_z("bolt", 0.009, r["z_rear"] - 0.07, r["z_rear"] + 0.02, BORE_Y, segments=8)
    bolt.box("bolt", (px + 0.008, py - 0.004, pz + kz - 0.004), (px + kx - 0.004, py + 0.004, pz + kz + 0.004))
    bolt.box_at("bolt", (0.012, 0.012, 0.012), (px + kx, py + ky, pz + kz), (0.6, 0.6, 0.0))
    m.part("trigger", (0.0, 0.004, -0.03)).box_at("metal", (0.005, 0.024, 0.005), (0.0, -0.01, -0.032), (0.3, 0.0, 0.0))
    magazine(m)
    return m


def simple():
    m = Model("lr24_tp")
    add_points(m)
    b = m.body
    r = REC
    s = SCOPE
    b.cyl_z("metal", r["radius"], r["z_front"], r["z_rear"], BORE_Y, segments=6)
    b.cyl_z("metal", 0.011, r["z_front"], MUZZLE_Z, BORE_Y, segments=5)
    for pts, t in ((FOREND, 0.04), (BED, 0.038), (BUTT, 0.036), (GRIP_PROFILE, 0.03)):
        b.profile("green", pts, t)
    b.cyl_z("metal", s["objective"], s["z_front"] - 0.12, s["z_rear"] + 0.07, SCOPE_Y, segments=6)
    b.box("metal", (-0.006, BORE_Y, -0.08), (0.006, SCOPE_Y, 0.06))
    m.part("magazine", MAG_WELL_POINT).box("metal", (-0.012, -0.03, MAGWELL["z_front"]), (0.012, 0.03, MAGWELL["z_rear"]))
    return m
