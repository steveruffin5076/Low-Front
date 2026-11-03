"""
BR-12 pump shotgun (fictional; 12 gauge, tube magazine), ~0.99 m overall.
Same layout as the code-built model (origin of the drawing at the top of the pistol grip, muzzle
along -Z). Gunsmith extras: an optic rail on the receiver (the ghost ring folds down under an
optic), a choke seat at the muzzle and a seat at the front of the magazine tube.
"""
from kit import Model

BORE_Y = 0.06
REC = dict(z_rear=0.07, z_front=-0.15, y_bottom=0.012, y_top=0.082, half=0.017)
MUZZLE_Z = -0.62
BARREL_R = 0.0115
TUBE = dict(y=0.03, radius=0.011, front=-0.5)
PUMP = dict(z_rear=-0.2, z_front=-0.37)
RIB_TOP = BORE_Y + BARREL_R + 0.005
SIGHT_Y = BORE_Y + 0.04
FRONT_POST_Z = MUZZLE_Z + 0.015
REAR_Z = 0.035
APERTURE = 0.0035
PORT = dict(z_rear=-0.02, z_front=-0.11)
STOCK_END = 0.37
SHELL = dict(radius=0.0105, length=0.068)
MAG_WELL_POINT = (0.0, REC["y_bottom"], (PORT["z_rear"] + PORT["z_front"]) / 2)
RAIL = dict(z_rear=-0.02, z_front=-0.14, y_base=REC["y_top"], top=0.088)

POINTS = {
    "pt_muzzle": (0.0, BORE_Y, MUZZLE_Z),
    "pt_ejectionPort": (0.018, 0.058, -0.06),
    "pt_sightAnchor": (0.0, SIGHT_Y, REAR_Z + 0.12),
    "pt_rightHandGrip": (0.0, -0.045, 0.04),
    "pt_leftHandGrip": (0.0, 0.012, -0.29),
    "pt_magWell": MAG_WELL_POINT,
    "mount_optic": (0.0, RAIL["top"] + 0.003, -0.085),
    "mount_muzzle": (0.0, BORE_Y, MUZZLE_Z),
    # The tube extension seats on the magazine tube cap.
    "mount_magazine": (0.0, TUBE["y"], TUBE["front"] - 0.025),
}

GRIP_PROFILE = [(0.01, 0.013), (0.045, 0.013), (0.075, -0.085), (0.064, -0.096), (0.042, -0.094), (0.014, -0.015)]
STOCK_PROFILE = [(0.07, 0.08), (STOCK_END, 0.06), (STOCK_END, -0.085), (STOCK_END - 0.03, -0.09), (0.17, -0.02), (0.1, 0.012), (0.07, 0.014)]
PUMP_PROFILE = [
    (PUMP["z_rear"], 0.05), (PUMP["z_front"], 0.05), (PUMP["z_front"], 0.012), (PUMP["z_front"] + 0.01, 0.006),
    (PUMP["z_rear"] - 0.01, 0.006), (PUMP["z_rear"], 0.012),
]
RECEIVER_TOP = [(-0.017, 0.072), (0.017, 0.072), (0.017, 0.078), (0.01, REC["y_top"]), (-0.01, REC["y_top"]), (-0.017, 0.078)]


def models():
    return [("guns/br12_fp", detailed()), ("guns/br12_tp", simple())]


def add_points(m):
    for name, pos in POINTS.items():
        m.point(name, pos)


def shell(part, material_hull, segments=8):
    mw = MAG_WELL_POINT
    y = REC["y_bottom"] + SHELL["radius"] + 0.002
    z0 = mw[2] - SHELL["length"] / 2
    z1 = mw[2] + SHELL["length"] / 2
    part.cyl_z(material_hull, SHELL["radius"], z0, z1 - 0.012, y, segments=segments)
    part.cyl_z("brass", SHELL["radius"] + 0.0008, z1 - 0.012, z1, y, segments=segments)


def detailed():
    m = Model("br12_fp")
    add_points(m)
    b = m.body
    r = REC

    # Milled receiver, ejection and loading ports, pins, optic rail.
    b.box("metal", (-r["half"], r["y_bottom"], r["z_front"]), (r["half"], 0.072, r["z_rear"]), bevel=0.0015)
    b.section("metal", RECEIVER_TOP, r["z_front"], r["z_rear"])
    b.box("interior", (r["half"], 0.046, -0.1), (r["half"] + 0.0005, 0.07, -0.025))
    b.box("interior", (-0.012, r["y_bottom"] - 0.0005, PORT["z_front"]), (0.012, r["y_bottom"], PORT["z_rear"]))
    for z in (-0.12, 0.04):
        b.cyl("metal", 0.0022, 0.037, (0.0, 0.024, z), axis="x", segments=6)
    b.box("metal", (-0.01, RAIL["y_base"], RAIL["z_front"]), (0.01, RAIL["top"], RAIL["z_rear"]))
    z = RAIL["z_rear"] - 0.006
    while z > RAIL["z_front"]:
        b.box("metal", (-0.01, RAIL["top"], z - 0.003), (0.01, RAIL["top"] + 0.003, z + 0.003))
        z -= 0.0125

    # Barrel with vent rib; magazine tube with its cap and the barrel clamp.
    b.cyl_z("metal", BARREL_R, r["z_front"], MUZZLE_Z, BORE_Y, segments=10)
    b.cyl_z("interior", 0.0095, MUZZLE_Z - 0.0005, MUZZLE_Z + 0.004, BORE_Y, segments=8)
    b.box("metal", (-0.004, BORE_Y + BARREL_R - 0.001, MUZZLE_Z + 0.005), (0.004, RIB_TOP, r["z_front"]))
    z = r["z_front"] - 0.03
    while z > MUZZLE_Z + 0.03:
        b.box("metal", (-0.0025, BORE_Y + BARREL_R - 0.001, z - 0.004), (0.0025, RIB_TOP, z + 0.004))
        z -= 0.045
    fz = FRONT_POST_Z
    b.box("metal", (-0.006, RIB_TOP - 0.002, fz - 0.01), (0.006, RIB_TOP + 0.006, fz + 0.01))
    b.box("metal", (-0.0012, RIB_TOP, fz - 0.004), (0.0012, SIGHT_Y - 0.002, fz + 0.004))
    b.box("brass", (-0.0012, SIGHT_Y - 0.002, fz - 0.003), (0.0012, SIGHT_Y, fz + 0.003))
    for x in (-0.0065, 0.0065):
        b.box("metal", (x - 0.0015, RIB_TOP, fz - 0.006), (x + 0.0015, SIGHT_Y + 0.003, fz + 0.006))
    b.cyl_z("metal", TUBE["radius"], r["z_front"], TUBE["front"], TUBE["y"], segments=8)
    b.cyl_z("metal", TUBE["radius"] + 0.002, TUBE["front"], TUBE["front"] - 0.025, TUBE["y"], segments=8)
    b.box("metal", (-0.008, TUBE["y"], TUBE["front"] + 0.005), (0.008, BORE_Y, TUBE["front"] + 0.02))

    # Stock with a pad, grip, trigger guard, cross-bolt safety.
    b.profile("polymer", STOCK_PROFILE, 0.036)
    b.box("polymer", (-0.02, -0.092, STOCK_END), (0.02, 0.062, STOCK_END + 0.012), bevel=0.003)
    b.profile("polymer", GRIP_PROFILE, 0.028)
    b.box("metal", (-0.006, -0.03, -0.07), (0.006, -0.025, 0.014))
    b.box("metal", (-0.006, -0.03, -0.075), (0.006, r["y_bottom"], -0.069))
    b.cyl("metal", 0.004, 0.04, (0.0, 0.0, -0.06), axis="x", segments=6)

    # --- Swappable: the ghost ring rear sight (folds down under an optic) ---
    rs = m.part("rearSight", (0.0, r["y_top"], REAR_Z + 0.01))
    rs.box("metal", (-0.012, r["y_top"], REAR_Z - 0.015), (0.012, SIGHT_Y - 0.009, REAR_Z + 0.01))
    rs.ring("metal", (0.0, SIGHT_Y), 0.009, APERTURE, REAR_Z - 0.0025, REAR_Z + 0.0025, segments=10)
    for x in (-0.0125, 0.0125):
        rs.box("metal", (x - 0.002, r["y_top"], REAR_Z - 0.008), (x + 0.002, SIGHT_Y + 0.006, REAR_Z + 0.008))

    # --- Moving parts ---
    pz = (PUMP["z_rear"] + PUMP["z_front"]) / 2
    pump = m.part("pump", (0.0, TUBE["y"], pz))
    pump.profile("polymer", PUMP_PROFILE, 0.046)
    z = PUMP["z_rear"] - 0.02
    while z > PUMP["z_front"] + 0.01:
        pump.box("polymer", (-0.0245, 0.012, z - 0.005), (0.0245, 0.046, z + 0.005))
        z -= 0.022
    for x in (-0.013, 0.013):
        pump.box("metal", (x - 0.0015, TUBE["y"] - 0.004, r["z_front"] - 0.01), (x + 0.0015, TUBE["y"] + 0.004, PUMP["z_rear"]))
    m.part("trigger", (0.0, 0.008, -0.03)).box_at("metal", (0.005, 0.026, 0.005), (0.0, -0.006, -0.032), (0.3, 0.0, 0.0))
    shell(m.part("magazine", MAG_WELL_POINT), "shell")
    return m


def simple():
    m = Model("br12_tp")
    add_points(m)
    b = m.body
    r = REC
    b.box("metal", (-r["half"], r["y_bottom"], r["z_front"]), (r["half"], r["y_top"], r["z_rear"]))
    b.cyl_z("metal", BARREL_R, r["z_front"], MUZZLE_Z, BORE_Y, segments=6)
    b.cyl_z("metal", TUBE["radius"], r["z_front"], TUBE["front"], TUBE["y"], segments=5)
    b.profile("polymer", STOCK_PROFILE, 0.036)
    b.profile("polymer", GRIP_PROFILE, 0.028)
    b.box("metal", (-0.003, BORE_Y, FRONT_POST_Z - 0.006), (0.003, SIGHT_Y, FRONT_POST_Z + 0.006))
    m.part("rearSight", (0.0, r["y_top"], REAR_Z + 0.01)).box("metal", (-0.01, r["y_top"], REAR_Z - 0.01), (0.01, SIGHT_Y + 0.006, REAR_Z + 0.01))
    m.part("pump", (0.0, TUBE["y"], (PUMP["z_rear"] + PUMP["z_front"]) / 2)).profile("polymer", PUMP_PROFILE, 0.046)
    mw = MAG_WELL_POINT
    m.part("magazine", mw).cyl_z("shell", SHELL["radius"], mw[2] - SHELL["length"] / 2, mw[2] + SHELL["length"] / 2, REC["y_bottom"] + SHELL["radius"] + 0.002, segments=5)
    return m
