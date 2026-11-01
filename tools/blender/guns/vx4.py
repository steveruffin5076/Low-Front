"""
VX-4 carbine (fictional; AR-15 family look), ~0.84 m overall, 0.37 m barrel.
Same layout as the code-built model it replaces, so animations and viewmodel poses still fit:
origin of the drawing at the top of the pistol grip, muzzle along -Z (the game re-centers on
pt_rightHandGrip).

Extra parts for the gunsmith:
- muzzleDevice: the birdcage flash hider, hidden when a muzzle attachment is fitted;
- rearSight: the flip-up rear sight, folded down under an optic;
- mount_optic / mount_muzzle / mount_underbarrel / mount_magazine: where attachments sit.
"""
import math

from kit import Model

BORE_Y = 0.072
UPPER = dict(z_rear=0.085, z_front=-0.105, y_bottom=0.045, y_top=0.094, half=0.014)
RAIL_TOP = 0.099
HANDGUARD = dict(z_rear=-0.105, z_front=-0.285, radius=0.024)
MUZZLE_Z = -0.55
THREAD_Z = -0.514
SIGHT_Y = BORE_Y + 0.066
REAR_SIGHT_Z = 0.068
FRONT_POST_Z = -0.3075
APERTURE = 0.0025
POST_HALF = 0.0009
PORT = dict(z_rear=-0.005, z_front=-0.06, y_bottom=0.058, y_top=0.082)
MAGWELL = dict(z_rear=-0.035, z_front=-0.108, y_bottom=-0.048)
MAG_WELL_POINT = (0.0, MAGWELL["y_bottom"], (MAGWELL["z_rear"] + MAGWELL["z_front"]) / 2)

POINTS = {
    "pt_muzzle": (0.0, BORE_Y, MUZZLE_Z),
    "pt_ejectionPort": (0.016, 0.07, (PORT["z_rear"] + PORT["z_front"]) / 2),
    "pt_sightAnchor": (0.0, SIGHT_Y, REAR_SIGHT_Z + 0.075),
    "pt_rightHandGrip": (0.0, -0.045, 0.032),
    "pt_leftHandGrip": (0.0, 0.045, -0.2),
    "pt_magWell": MAG_WELL_POINT,
    # Gunsmith mounts: the rail top over the receiver, the barrel thread, the bottom rail, the mag well.
    "mount_optic": (0.0, RAIL_TOP + 0.003, -0.01),
    "mount_muzzle": (0.0, BORE_Y, THREAD_Z),
    "mount_underbarrel": (0.0, BORE_Y - HANDGUARD["radius"] - 0.007, -0.215),
    "mount_magazine": MAG_WELL_POINT,
}

LOWER_PROFILE = [
    (0.085, 0.045), (0.085, 0.012), (0.06, 0.0), (-0.03, 0.0), (-0.035, -0.04), (-0.04, -0.048),
    (-0.108, -0.048), (-0.106, 0.0), (-0.112, 0.02), (-0.105, 0.045),
]
GRIP_PROFILE = [(-0.008, 0.002), (0.03, 0.002), (0.05, -0.04), (0.062, -0.088), (0.055, -0.096), (0.025, -0.096), (0.012, -0.05)]
STOCK_PROFILE = [(0.165, 0.09), (0.28, 0.096), (0.28, -0.04), (0.255, -0.04), (0.205, 0.035), (0.175, 0.05), (0.165, 0.06)]
MAG_PROFILE = [
    (0.03, 0.045), (-0.03, 0.045), (-0.031, 0.0), (-0.036, -0.06), (-0.046, -0.115), (-0.05, -0.124),
    (-0.016, -0.13), (0.008, -0.12), (0.02, -0.06), (0.028, 0.0),
]


def models():
    return [("guns/vx4_fp", detailed()), ("guns/vx4_tp", simple())]


def magazine(m, pivot, profile=MAG_PROFILE, length_scale=1.0):
    """STANAG-style magazine in mag-local coordinates (pivot = bottom of the mag well)."""
    px, py, pz = pivot
    pts = [(z + pz, y * (length_scale if y < 0 else 1.0) + py) for z, y in profile]
    mag = m.part("magazine", pivot)
    mag.profile("metal", pts, 0.022)
    bottom = MAGWELL["y_bottom"] - 0.13 * length_scale
    mag.box("polymer", (-0.0135, bottom - 0.007, -0.128), (0.0135, bottom + 0.002, -0.054), bevel=0.002)
    # Stiffening ribs down the sides.
    for x in (-0.0115, 0.0115):
        mag.box("metal", (x - 0.0006, MAGWELL["y_bottom"] - 0.1 * length_scale, -0.09), (x + 0.0006, MAGWELL["y_bottom"] - 0.01, -0.075))
    return mag


def rail(part, z_rear, z_front, y_base, width, pitch=0.0125):
    """Picatinny rail: base strip with cross slots (ridges every `pitch`)."""
    part.box("metal", (-width / 2, y_base, z_front), (width / 2, RAIL_TOP, z_rear))
    z = z_rear - pitch / 2
    while z > z_front:
        part.box("metal", (-width / 2, RAIL_TOP, z - pitch * 0.25), (width / 2, RAIL_TOP + 0.003, z + pitch * 0.25))
        z -= pitch


def detailed():
    m = Model("vx4_fp")
    for name, pos in POINTS.items():
        m.point(name, pos)
    b = m.body
    u = UPPER

    # Lower receiver with a beveled mag well, pistol grip, trigger guard.
    b.profile("metal", LOWER_PROFILE, 0.026)
    b.box("metal", (-0.0145, -0.048, -0.112), (0.0145, -0.04, -0.03), bevel=0.002)
    b.profile("polymer", GRIP_PROFILE, 0.026)
    b.box("metal", (-0.006, -0.036, -0.036), (0.006, -0.03, 0.008))
    b.box("metal", (-0.006, -0.036, -0.036), (0.006, 0.0, -0.03))
    b.cyl("metal", 0.004, 0.003, (0.0145, 0.03, 0.045), axis="x", segments=6)
    # Takedown and pivot pins.
    for z in (-0.095, 0.07):
        b.cyl("metal", 0.0028, 0.03, (0.0, 0.035, z), axis="x", segments=6)

    # Upper receiver around the ejection port, with chamfered edges.
    split = 0.006
    b.box("metal", (-u["half"], u["y_bottom"], u["z_front"]), (split, u["y_top"], u["z_rear"]), bevel=0.0015)
    b.box("metal", (split, u["y_bottom"], u["z_front"]), (u["half"], PORT["y_bottom"], u["z_rear"]))
    b.box("metal", (split, PORT["y_top"], u["z_front"]), (u["half"], u["y_top"], u["z_rear"]))
    b.box("metal", (split, PORT["y_bottom"], u["z_front"]), (u["half"], PORT["y_top"], PORT["z_front"]))
    b.box("metal", (split, PORT["y_bottom"], PORT["z_rear"]), (u["half"], PORT["y_top"], u["z_rear"]))
    b.box("interior", (split - 0.0005, PORT["y_bottom"], PORT["z_front"]), (split, PORT["y_top"], PORT["z_rear"]))
    # Forward assist and the brass deflector.
    b.box("metal", (0.012, 0.072, 0.018), (0.02, 0.09, 0.06), bevel=0.002)
    b.cyl_z("metal", 0.0065, 0.06, 0.077, 0.082, x=0.017, segments=10)
    b.box("metal", (0.014, 0.084, 0.005), (0.019, 0.094, 0.018))

    # Flat-top rail continuing along the handguard.
    rail(b, u["z_rear"] - 0.005, HANDGUARD["z_front"] + 0.005, u["y_top"], 0.021)

    # Free-float handguard: octagonal tube with M-LOK style slots and three short rails.
    hg = HANDGUARD
    b.cyl_z("metal", hg["radius"], hg["z_rear"], hg["z_front"], BORE_Y, segments=8)
    b.cyl_z("metal", hg["radius"] + 0.002, hg["z_rear"], hg["z_rear"] - 0.012, BORE_Y, segments=8)
    for side in (-1, 1):
        for z in (-0.13, -0.17, -0.21, -0.25):
            b.box("interior", (side * (hg["radius"] + 0.0003) - 0.0006, BORE_Y - 0.004, z - 0.014), (side * (hg["radius"] + 0.0003) + 0.0006, BORE_Y + 0.004, z + 0.014))
    hg_mid = (hg["z_rear"] + hg["z_front"]) / 2
    for side in (-1, 1):
        b.box("metal", (side * hg["radius"] - 0.003, BORE_Y - 0.007, hg["z_front"]), (side * hg["radius"] + 0.003, BORE_Y + 0.007, hg["z_front"] + 0.08))
    b.box("metal", (-0.007, BORE_Y - hg["radius"] - 0.006, hg["z_front"] + 0.005), (0.007, BORE_Y - hg["radius"], hg["z_rear"] - 0.02))
    z = hg["z_rear"] - 0.025
    while z > hg["z_front"] + 0.01:
        b.box("metal", (-0.009, BORE_Y - hg["radius"] - 0.008, z - 0.003), (0.009, BORE_Y - hg["radius"] - 0.006, z + 0.003))
        z -= 0.0125
    del hg_mid

    # Barrel (thinner past the gas block), front sight base, thread.
    b.cyl_z("metal", 0.0085, hg["z_front"], -0.36, BORE_Y, segments=10)
    b.cyl_z("metal", 0.0075, -0.36, THREAD_Z, BORE_Y, segments=10)
    b.cyl_z("metal", 0.0065, THREAD_Z, THREAD_Z - 0.004, BORE_Y, segments=8)
    fz = FRONT_POST_Z
    b.box("metal", (-0.011, 0.058, fz - 0.0175), (0.011, 0.086, fz + 0.0175), bevel=0.0015)
    b.profile("metal", [(fz + 0.0175, 0.086), (fz - 0.0175, 0.086), (fz - 0.007, SIGHT_Y - 0.024), (fz + 0.005, SIGHT_Y - 0.024)], 0.016)
    b.box("metal", (-0.0095, SIGHT_Y - 0.026, fz - 0.004), (0.0095, SIGHT_Y - 0.021, fz + 0.004))
    b.box("metal", (-0.0095, SIGHT_Y - 0.023, fz - 0.0035), (-0.0055, SIGHT_Y + 0.002, fz + 0.0035))
    b.box("metal", (0.0055, SIGHT_Y - 0.023, fz - 0.0035), (0.0095, SIGHT_Y + 0.002, fz + 0.0035))
    b.box("metal", (-POST_HALF, SIGHT_Y - 0.022, fz - POST_HALF), (POST_HALF, SIGHT_Y, fz + POST_HALF))
    b.box("metal", (-0.004, 0.048, fz - 0.0125), (0.004, 0.058, fz + 0.0075))

    # Buffer tube, castle nut, stock notches; collapsible stock with cheek riser and butt pad.
    b.cyl_z("metal", 0.0145, u["z_rear"], 0.255, 0.07, segments=10)
    b.cyl_z("metal", 0.017, u["z_rear"], u["z_rear"] + 0.01, 0.07, segments=10)
    for i in range(4):
        b.box_at("metal", (0.006, 0.004, 0.004), (0.0, 0.0545, 0.115 + i * 0.015))
    b.profile("polymer", STOCK_PROFILE, 0.04)
    b.box("polymer", (-0.022, 0.06, 0.2), (0.022, 0.098, 0.275), bevel=0.004)
    b.box("polymer", (-0.021, -0.042, 0.28), (0.021, 0.098, 0.292), bevel=0.003)
    b.box("polymer", (-0.005, 0.024, 0.17), (0.005, 0.034, 0.2))
    # Sling loop at the rear of the stock.
    b.ring("metal", (0.0, -0.03), 0.008, 0.005, 0.26, 0.266, segments=8)

    # --- Parts the gunsmith swaps ---
    # Birdcage flash hider (slots as dark strips).
    md = m.part("muzzleDevice", POINTS["mount_muzzle"])
    md.cyl_z("metal", 0.0105, THREAD_Z, MUZZLE_Z, BORE_Y, segments=10)
    for a in range(5):
        ang = math.pi / 2 + a * 2 * math.pi / 5
        x, y = math.cos(ang) * 0.0103, math.sin(ang) * 0.0103
        md.box_at("interior", (0.003, 0.003, 0.022), (x, BORE_Y + y, -0.534), (0.0, 0.0, ang))
    md.cyl_z("interior", 0.0045, MUZZLE_Z - 0.0005, MUZZLE_Z + 0.002, BORE_Y, segments=8)

    # Flip-up rear sight: base, protective wings, and a leaf with a round peep aperture.
    rz = REAR_SIGHT_Z
    leaf_base = RAIL_TOP + 0.01
    rs = m.part("rearSight", (0.0, RAIL_TOP + 0.003, rz))
    rs.box("metal", (-0.0125, RAIL_TOP, rz - 0.014), (0.0125, leaf_base, rz + 0.014), bevel=0.0015)
    rs.box("metal", (-0.0125, leaf_base, rz - 0.005), (-0.0095, SIGHT_Y + 0.006, rz + 0.005))
    rs.box("metal", (0.0095, leaf_base, rz - 0.005), (0.0125, SIGHT_Y + 0.006, rz + 0.005))
    rs.box("metal", (-0.0085, leaf_base, rz - 0.0015), (0.0085, SIGHT_Y - APERTURE - 0.002, rz + 0.0015))
    rs.ring("metal", (0.0, SIGHT_Y), APERTURE + 0.004, APERTURE, rz - 0.0015, rz + 0.0015, segments=12)
    rs.cyl("metal", 0.005, 0.004, (0.0155, leaf_base - 0.003, rz), axis="x", segments=6)

    # --- Moving parts (same pivots as before) ---
    m.part("bolt", (0.009, 0.07, -0.03)).box("bolt", (split, 0.06, -0.065), (0.0125, 0.08, 0.015))
    m.part("dustCover", (u["half"] + 0.0008, PORT["y_bottom"] - 0.001, (PORT["z_rear"] + PORT["z_front"]) / 2)).box(
        "metal", (u["half"], PORT["y_bottom"] - 0.001, PORT["z_front"] - 0.002), (u["half"] + 0.0016, PORT["y_top"] + 0.001, PORT["z_rear"] + 0.002)
    )
    ch = m.part("chargingHandle", (0.0, 0.088, u["z_rear"]))
    ch.box("metal", (-0.005, 0.084, u["z_rear"] - 0.01), (0.005, 0.092, u["z_rear"] + 0.012))
    ch.box("metal", (-0.019, 0.083, u["z_rear"] + 0.012), (0.019, 0.093, u["z_rear"] + 0.02), bevel=0.002)
    m.part("trigger", (0.0, 0.0, -0.012)).box_at("metal", (0.005, 0.022, 0.005), (0.0, -0.012, -0.014), (0.25, 0.0, 0.0))
    sel = m.part("selector", (-0.0145, 0.03, 0.045))
    sel.cyl("metal", 0.005, 0.003, (-0.0145, 0.03, 0.045), axis="x", segments=8)
    sel.box("metal", (-0.017, 0.027, 0.03), (-0.015, 0.033, 0.047))
    m.part("boltRelease", (-0.0145, 0.028, -0.03)).box("metal", (-0.018, 0.018, -0.042), (-0.0135, 0.034, -0.02))
    magazine(m, MAG_WELL_POINT)
    return m


def simple():
    """Third-person silhouette, under 300 triangles."""
    m = Model("vx4_tp")
    for name, pos in POINTS.items():
        m.point(name, pos)
    b = m.body
    u = UPPER
    hg = HANDGUARD
    b.box("metal", (-u["half"], 0.0, u["z_front"]), (u["half"], u["y_top"] + 0.005, u["z_rear"]))
    b.box("metal", (-0.012, -0.045, MAGWELL["z_front"]), (0.012, 0.0, MAGWELL["z_rear"]))
    b.cyl_z("metal", hg["radius"], hg["z_rear"], hg["z_front"], BORE_Y, segments=6)
    b.cyl_z("metal", 0.009, hg["z_front"], THREAD_Z, BORE_Y, segments=5)
    b.profile("metal", [(-0.29, 0.06), (-0.325, 0.06), (-0.312, SIGHT_Y), (-0.303, SIGHT_Y)], 0.012)
    b.cyl_z("metal", 0.0145, u["z_rear"], 0.2, 0.07, segments=5)
    b.profile("polymer", GRIP_PROFILE, 0.026)
    b.profile("polymer", STOCK_PROFILE, 0.04)
    m.part("muzzleDevice", POINTS["mount_muzzle"]).cyl_z("metal", 0.0105, THREAD_Z, MUZZLE_Z, BORE_Y, segments=5)
    m.part("rearSight", (0.0, RAIL_TOP + 0.003, REAR_SIGHT_Z)).box("metal", (-0.008, RAIL_TOP, 0.055), (0.008, SIGHT_Y + 0.008, 0.08))
    m.part("magazine", MAG_WELL_POINT).profile("metal", [(z + MAG_WELL_POINT[2], y + MAG_WELL_POINT[1]) for z, y in MAG_PROFILE], 0.022)
    return m
