"""
SR-9 submachine gun (fictional; roller-delayed 9 mm look), ~0.68 m with the stock out.
Same layout as the code-built model (origin of the drawing at the top of the pistol grip, muzzle
along -Z). Gunsmith extras: a claw-mount rail over the receiver, a short bottom rail on the
handguard, the three-lug muzzle as a swappable muzzleDevice, and the mounts.
"""
import math

from kit import Model

BORE_Y = 0.055
REC = dict(z_rear=0.06, z_front=-0.2, y_bottom=0.03, y_top=0.085, half=0.017)
MUZZLE_Z = -0.405
LUG_Z = MUZZLE_Z + 0.02
SIGHT_Y = BORE_Y + 0.05
FRONT_POST_Z = -0.355
REAR_Z = 0.035
APERTURE = 0.0032
TUBE_Y = 0.083
MAGWELL = dict(z_rear=-0.06, z_front=-0.11)
MAG_WELL_POINT = (0.0, REC["y_bottom"], (MAGWELL["z_rear"] + MAGWELL["z_front"]) / 2)
STOCK_END = 0.275
RAIL = dict(z_rear=-0.02, z_front=-0.15, y_base=0.088, top=0.094)

POINTS = {
    "pt_muzzle": (0.0, BORE_Y, MUZZLE_Z),
    "pt_ejectionPort": (0.018, 0.062, -0.04),
    "pt_sightAnchor": (0.0, SIGHT_Y, REAR_Z + 0.19),
    "pt_rightHandGrip": (0.0, -0.045, 0.04),
    "pt_leftHandGrip": (0.0, 0.02, -0.22),
    "pt_magWell": MAG_WELL_POINT,
    "mount_optic": (0.0, RAIL["top"] + 0.003, -0.075),
    "mount_muzzle": (0.0, BORE_Y, LUG_Z),
    "mount_underbarrel": (0.0, 0.008, -0.225),
    "mount_magazine": MAG_WELL_POINT,
}

GRIP_PROFILE = [(0.0, 0.03), (0.04, 0.03), (0.07, -0.08), (0.058, -0.092), (0.036, -0.09), (0.008, -0.01)]
HOUSING = [(0.06, 0.03), (-0.03, 0.03), (-0.03, 0.005), (0.0, -0.005), (0.06, 0.005)]
HANDGUARD = [(-0.115, 0.07), (-0.3, 0.07), (-0.3, 0.03), (-0.29, 0.015), (-0.13, 0.015), (-0.115, 0.03)]
RECEIVER_TOP = [(-0.017, 0.07), (0.017, 0.07), (0.017, 0.08), (0.011, 0.088), (-0.011, 0.088), (-0.017, 0.08)]
MAG_PROFILE = [(0.022, 0.03), (0.026, -0.05), (0.04, -0.15), (0.002, -0.155), (-0.012, -0.05), (-0.02, 0.03)]


def models():
    return [("guns/sr9_fp", detailed()), ("guns/sr9_tp", simple())]


def add_points(m):
    for name, pos in POINTS.items():
        m.point(name, pos)


def mag_points():
    mw = MAG_WELL_POINT
    return [(z + mw[2], y + mw[1]) for z, y in MAG_PROFILE]


def detailed():
    m = Model("sr9_fp")
    add_points(m)
    b = m.body
    r = REC

    # Stamped receiver with a rounded top, cocking tube, ejection port, pins.
    b.box("metal", (-r["half"], r["y_bottom"], r["z_front"]), (r["half"], 0.07, r["z_rear"]), bevel=0.0012)
    b.section("metal", RECEIVER_TOP, r["z_front"], r["z_rear"])
    b.cyl_z("metal", 0.011, r["z_front"], -0.335, TUBE_Y, segments=10)
    b.box("interior", (r["half"], 0.052, -0.065), (r["half"] + 0.0005, 0.072, -0.015))
    for z in (-0.17, -0.12, 0.02):
        b.cyl("metal", 0.002, 0.036, (0.0, 0.04, z), axis="x", segments=6)
    # Claw-mount rail over the receiver (for optics).
    b.box("metal", (-0.009, RAIL["y_base"], RAIL["z_front"]), (0.009, RAIL["top"], RAIL["z_rear"]))
    for side in (-1, 1):
        b.box("metal", (side * 0.0105 - 0.0015, 0.08, RAIL["z_front"] + 0.01), (side * 0.0105 + 0.0015, RAIL["y_base"] + 0.002, RAIL["z_front"] + 0.025))
        b.box("metal", (side * 0.0105 - 0.0015, 0.08, RAIL["z_rear"] - 0.025), (side * 0.0105 + 0.0015, RAIL["y_base"] + 0.002, RAIL["z_rear"] - 0.01))
    z = RAIL["z_rear"] - 0.006
    while z > RAIL["z_front"]:
        b.box("metal", (-0.009, RAIL["top"], z - 0.003), (0.009, RAIL["top"] + 0.003, z + 0.003))
        z -= 0.0125

    # Barrel, polymer handguard with a bottom rail, trigger housing, grip.
    b.cyl_z("metal", 0.0075, r["z_front"], LUG_Z, BORE_Y, segments=10)
    b.profile("polymer", HANDGUARD, 0.044)
    b.box("metal", (-0.007, 0.008, -0.27), (0.007, 0.015, -0.18))
    for zz in (-0.262, -0.249, -0.236, -0.223, -0.21, -0.197):
        b.box("metal", (-0.009, 0.006, zz - 0.003), (0.009, 0.008, zz + 0.003))
    b.profile("polymer", HOUSING, 0.03)
    b.profile("polymer", GRIP_PROFILE, 0.028)
    b.box("metal", (-0.005, -0.012, -0.03), (0.005, -0.007, 0.03))

    # Front sight: a ring hood around a round post, on a block over the cocking tube.
    fz = FRONT_POST_Z
    b.box("metal", (-0.009, TUBE_Y, fz - 0.012), (0.009, SIGHT_Y - 0.012, fz + 0.012))
    b.ring("metal", (0.0, SIGHT_Y), 0.014, 0.011, fz - 0.008, fz + 0.008, segments=10)
    b.cyl("metal", 0.0012, 0.013, (0.0, SIGHT_Y - 0.0065, fz), axis="y", segments=6)

    # Rear sight: a round drum with the aperture on the sight line.
    b.box("metal", (-0.009, 0.088, REAR_Z - 0.012), (0.009, SIGHT_Y - 0.012, REAR_Z + 0.012))
    b.ring("metal", (0.0, SIGHT_Y), 0.012, APERTURE, REAR_Z - 0.004, REAR_Z + 0.004, segments=10)

    # Retractable stock: two rods and a butt pad.
    for y in (0.075, 0.035):
        b.cyl_z("metal", 0.004, r["z_rear"], STOCK_END - 0.012, y, segments=6)
    b.box("polymer", (-0.02, -0.06, STOCK_END - 0.014), (0.02, 0.085, STOCK_END), bevel=0.003)

    # --- Swappable: three-lug muzzle ---
    md = m.part("muzzleDevice", POINTS["mount_muzzle"])
    md.cyl_z("metal", 0.0105, LUG_Z, MUZZLE_Z, BORE_Y, segments=10)
    for i in range(3):
        a = i / 3 * math.pi * 2
        md.box_at("metal", (0.004, 0.004, 0.012), (math.cos(a) * 0.012, BORE_Y + math.sin(a) * 0.012, MUZZLE_Z + 0.03))
    md.cyl_z("interior", 0.0045, MUZZLE_Z - 0.0005, MUZZLE_Z + 0.004, BORE_Y, segments=6)

    # --- Moving parts ---
    m.part("bolt", (r["half"], 0.062, -0.04)).box("bolt", (r["half"] - 0.006, 0.054, -0.06), (r["half"] - 0.001, 0.07, -0.02))
    ch = m.part("chargingHandle", (r["half"], TUBE_Y, -0.3))
    ch.box("metal", (0.008, TUBE_Y - 0.004, -0.305), (r["half"] + 0.012, TUBE_Y + 0.004, -0.295))
    ch.cyl("metal", 0.005, 0.012, (r["half"] + 0.016, TUBE_Y, -0.3), axis="x", segments=8)
    m.part("selector", (r["half"] + 0.001, 0.015, 0.03)).box("metal", (r["half"], 0.008, 0.02), (r["half"] + 0.003, 0.026, 0.04))
    m.part("trigger", (0.0, 0.008, -0.01)).box_at("metal", (0.005, 0.024, 0.005), (0.0, -0.005, -0.012), (0.3, 0.0, 0.0))
    m.part("magazine", MAG_WELL_POINT).profile("metal", mag_points(), 0.022)
    return m


def simple():
    m = Model("sr9_tp")
    add_points(m)
    b = m.body
    r = REC
    b.box("metal", (-r["half"], r["y_bottom"], r["z_front"]), (r["half"], 0.088, r["z_rear"]))
    b.cyl_z("metal", 0.008, r["z_front"], LUG_Z, BORE_Y, segments=5)
    b.cyl_z("metal", 0.011, r["z_front"], -0.335, TUBE_Y, segments=5)
    b.profile("polymer", HANDGUARD, 0.044)
    b.profile("polymer", GRIP_PROFILE, 0.028)
    b.profile("polymer", HOUSING, 0.03)
    b.box("metal", (-0.008, TUBE_Y, FRONT_POST_Z - 0.01), (0.008, SIGHT_Y + 0.008, FRONT_POST_Z + 0.01))
    b.box("metal", (-0.008, 0.088, REAR_Z - 0.01), (0.008, SIGHT_Y + 0.008, REAR_Z + 0.01))
    b.box("polymer", (-0.02, -0.06, STOCK_END - 0.014), (0.02, 0.085, STOCK_END))
    b.box("metal", (-0.004, 0.03, r["z_rear"]), (0.004, 0.08, STOCK_END - 0.014))
    m.part("muzzleDevice", POINTS["mount_muzzle"]).cyl_z("metal", 0.0105, LUG_Z, MUZZLE_Z, BORE_Y, segments=5)
    m.part("magazine", MAG_WELL_POINT).profile("metal", mag_points(), 0.022)
    return m
