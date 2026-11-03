"""
KR-7 rifle (fictional; AK family look), ~0.88 m overall, 0.415 m barrel.
Same layout as the code-built model it replaces (origin of the drawing at the top of the pistol
grip, muzzle along -Z). Gunsmith extras: a short optic rail on the dust cover, a bottom rail on
the lower handguard, the slant brake as a swappable muzzleDevice, and the mounts.
"""
from kit import Model, arc

BORE_Y = 0.058
REC = dict(z_rear=0.095, z_front=-0.135, y_bottom=0.012, y_top=0.07, half=0.015)
MUZZLE_Z = -0.58
BRAKE_Z = -0.545
SIGHT_Y = BORE_Y + 0.0485
FRONT_POST_Z = -0.494
NOTCH_Z = FRONT_POST_Z + 0.378
NOTCH = dict(half=0.0017, depth=0.0032)
POST_R = 0.001
GAS_Y = 0.085
MAGWELL = dict(z_rear=-0.07, z_front=-0.125)
MAG_WELL_POINT = (0.0, REC["y_bottom"], (MAGWELL["z_rear"] + MAGWELL["z_front"]) / 2)
RAIL = dict(z_rear=0.07, z_front=-0.075, y_base=0.084, top=0.091)

POINTS = {
    "pt_muzzle": (0.0, BORE_Y, MUZZLE_Z),
    "pt_ejectionPort": (0.016, 0.06, -0.02),
    "pt_sightAnchor": (0.0, SIGHT_Y, NOTCH_Z + 0.26),
    "pt_rightHandGrip": (0.0, -0.045, 0.04),
    "pt_leftHandGrip": (0.0, 0.02, -0.26),
    "pt_magWell": MAG_WELL_POINT,
    "mount_optic": (0.0, RAIL["top"] + 0.003, -0.005),
    "mount_muzzle": (0.0, BORE_Y, BRAKE_Z),
    "mount_underbarrel": (0.0, 0.013, -0.3),
    "mount_magazine": MAG_WELL_POINT,
}

GRIP_PROFILE = [(0.01, 0.013), (0.045, 0.013), (0.075, -0.085), (0.064, -0.096), (0.042, -0.094), (0.014, -0.015)]
STOCK_PROFILE = [(0.095, 0.068), (0.295, 0.033), (0.295, -0.092), (0.28, -0.094), (0.16, -0.012), (0.12, 0.012), (0.095, 0.015)]
LOWER_HANDGUARD = [
    (-0.14, 0.071), (-0.372, 0.071), (-0.372, 0.032), (-0.355, 0.024), (-0.3, 0.026), (-0.27, 0.021), (-0.22, 0.024),
    (-0.16, 0.019), (-0.14, 0.016),
]
DUST_COVER = [(-0.015, 0.07), (0.015, 0.07), (0.015, 0.078), (0.01, 0.085), (0.0, 0.087), (-0.01, 0.085), (-0.015, 0.078)]


def mag_profile(stretch=1.0, extra_sweep=0.0):
    """Banana magazine in gun coordinates (pivot = mag well): two arcs around a center ahead of the gun."""
    center = (-0.44, 0.0)
    sweep = 0.5 * stretch + extra_sweep
    rear = arc(center, 0.465, 0.0, sweep, 6)
    front = list(reversed(arc(center, 0.408, 0.0, sweep, 6)))
    return [(0.025, 0.035)] + rear + front + [(-0.032, 0.035)]


def models():
    return [("guns/kr7_fp", detailed()), ("guns/kr7_tp", simple())]


def add_points(m):
    for name, pos in POINTS.items():
        m.point(name, pos)


def detailed():
    m = Model("kr7_fp")
    add_points(m)
    b = m.body
    r = REC

    # Stamped receiver with chamfers, ribbed dust cover with a short optic rail, rivets.
    b.box("metal", (-r["half"], r["y_bottom"], r["z_front"]), (r["half"], r["y_top"], r["z_rear"]), bevel=0.0015)
    b.section("metal", DUST_COVER, -0.1, r["z_rear"] + 0.012)
    b.box("metal", (-0.004, 0.078, r["z_rear"] + 0.012), (0.004, 0.084, r["z_rear"] + 0.018))
    for z in (-0.115, -0.09, 0.07, 0.03):
        for x in (-r["half"], r["half"]):
            b.cyl("metal", 0.002, 0.002, (x, 0.02, z), axis="x", segments=6)
    b.box("interior", (r["half"], 0.052, -0.08), (r["half"] + 0.0005, 0.058, 0.05))
    b.box("metal", (-0.011, RAIL["y_base"], RAIL["z_front"]), (0.011, RAIL["top"], RAIL["z_rear"]))
    z = RAIL["z_rear"] - 0.006
    while z > RAIL["z_front"]:
        b.box("metal", (-0.011, RAIL["top"], z - 0.003), (0.011, RAIL["top"] + 0.003, z + 0.003))
        z -= 0.0125

    # Rear sight block and tangent leaf with the U-notch.
    nz = NOTCH_Z
    b.box("metal", (-0.013, 0.06, -0.17), (0.013, 0.08, nz + 0.012), bevel=0.0015)
    b.box("metal", (-0.009, 0.08, -0.165), (0.009, 0.0845, nz))
    b.box("metal", (-0.011, 0.0845, nz - 0.022), (0.011, 0.09, nz + 0.0005))
    n = NOTCH
    b.section(
        "metal",
        [(-0.011, 0.09), (0.011, 0.09), (0.011, SIGHT_Y), (n["half"], SIGHT_Y), (n["half"], SIGHT_Y - n["depth"]),
         (-n["half"], SIGHT_Y - n["depth"]), (-n["half"], SIGHT_Y), (-0.011, SIGHT_Y)],
        nz - 0.0015, nz + 0.0015,
    )

    # Barrel, gas tube in a wood upper handguard, wood lower handguard with a bottom rail, gas block.
    b.cyl_z("metal", 0.0085, r["z_front"], BRAKE_Z, BORE_Y, segments=10)
    b.cyl_z("metal", 0.011, -0.165, -0.425, GAS_Y, segments=8)
    b.cyl_z("wood", 0.0145, -0.17, -0.35, GAS_Y, segments=10)
    b.profile("wood", LOWER_HANDGUARD, 0.04)
    b.box("metal", (-0.007, 0.011, -0.34), (0.007, 0.018, -0.25))
    for zz in (-0.33, -0.317, -0.304, -0.291, -0.278, -0.265):
        b.box("metal", (-0.009, 0.009, zz - 0.003), (0.009, 0.011, zz + 0.003))
    b.box("metal", (-0.021, 0.022, -0.385), (0.021, 0.075, -0.372))
    b.box("metal", (-0.011, 0.046, -0.44), (0.011, 0.096, -0.415), bevel=0.0015)
    b.box_at("metal", (0.016, 0.02, 0.014), (0.0, 0.07, -0.41), (0.6, 0.0, 0.0))

    # Front sight tower with ears around a round post.
    fz = FRONT_POST_Z
    b.box("metal", (-0.011, 0.045, fz - 0.011), (0.011, 0.07, fz + 0.012))
    b.profile("metal", [(fz + 0.014, 0.07), (fz - 0.013, 0.07), (fz - 0.006, SIGHT_Y - 0.02), (fz + 0.006, SIGHT_Y - 0.02)], 0.016)
    b.box("metal", (-0.0095, SIGHT_Y - 0.022, fz - 0.004), (-0.0055, SIGHT_Y + 0.004, fz + 0.004))
    b.box("metal", (0.0055, SIGHT_Y - 0.022, fz - 0.004), (0.0095, SIGHT_Y + 0.004, fz + 0.004))
    b.cyl("metal", POST_R, 0.02, (0.0, SIGHT_Y - 0.01, fz), axis="y", segments=6)

    # Wood stock with a steel butt plate, wood grip, steel trigger guard.
    b.profile("wood", STOCK_PROFILE, 0.036)
    b.box("metal", (-0.019, -0.096, 0.295), (0.019, 0.036, 0.302))
    b.profile("wood", GRIP_PROFILE, 0.028)
    b.box("metal", (-0.006, -0.032, -0.065), (0.006, -0.027, 0.012))
    b.box("metal", (-0.006, -0.032, -0.07), (0.006, r["y_bottom"], -0.064))

    # --- Swappable: slant muzzle brake, longer on top ---
    md = m.part("muzzleDevice", POINTS["mount_muzzle"])
    md.profile("metal", [(BRAKE_Z, 0.071), (MUZZLE_Z, 0.071), (MUZZLE_Z + 0.01, 0.045), (BRAKE_Z, 0.045)], 0.022)
    md.cyl_z("interior", 0.0045, MUZZLE_Z - 0.0005, MUZZLE_Z + 0.004, BORE_Y, segments=6)

    # --- Moving parts ---
    sel = m.part("selector", (r["half"] + 0.001, 0.058, 0.08))
    sel.box("metal", (r["half"], 0.052, -0.045), (r["half"] + 0.002, 0.064, 0.085))
    sel.box("metal", (r["half"], 0.042, -0.045), (r["half"] + 0.004, 0.054, -0.032))
    ch = m.part("chargingHandle", (r["half"], 0.055, -0.065))
    ch.box("metal", (r["half"], 0.051, -0.07), (r["half"] + 0.012, 0.059, -0.06))
    ch.cyl("metal", 0.0065, 0.012, (r["half"] + 0.017, 0.055, -0.065), axis="x", segments=8)
    m.part("trigger", (0.0, 0.008, -0.02)).box_at("metal", (0.005, 0.026, 0.005), (0.0, -0.006, -0.022), (0.3, 0.0, 0.0))
    m.part("magazine", MAG_WELL_POINT).profile("metal", [(zz + MAG_WELL_POINT[2], y + MAG_WELL_POINT[1]) for zz, y in mag_profile()], 0.024)
    return m


def simple():
    m = Model("kr7_tp")
    add_points(m)
    b = m.body
    r = REC
    b.box("metal", (-r["half"], r["y_bottom"], r["z_front"]), (r["half"], 0.085, r["z_rear"]))
    b.cyl_z("metal", 0.009, r["z_front"], BRAKE_Z, BORE_Y, segments=5)
    b.cyl_z("wood", 0.0145, -0.17, -0.35, GAS_Y, segments=5)
    b.profile("wood", LOWER_HANDGUARD, 0.04)
    b.box("metal", (-0.008, 0.045, FRONT_POST_Z - 0.011), (0.008, SIGHT_Y, FRONT_POST_Z + 0.012))
    b.box("metal", (-0.01, r["y_top"], -0.17), (0.01, SIGHT_Y, NOTCH_Z))
    b.profile("wood", STOCK_PROFILE, 0.036)
    b.profile("wood", GRIP_PROFILE, 0.028)
    m.part("muzzleDevice", POINTS["mount_muzzle"]).box("metal", (-0.01, 0.047, MUZZLE_Z), (0.01, 0.07, BRAKE_Z))
    m.part("magazine", MAG_WELL_POINT).profile("metal", [(zz + MAG_WELL_POINT[2], y + MAG_WELL_POINT[1]) for zz, y in mag_profile()], 0.024)
    return m

