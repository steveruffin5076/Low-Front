"""
P-11 pistol (fictional; single-action .45 look), ~0.22 m overall.
Same layout as the code-built model (origin of the drawing at the top of the grip, muzzle along
-Z). Gunsmith extras: an optic seat on the slide and a muzzle seat at the bushing; both are
parented to the slide so the parts move with it. The magazine mount is the mag well.
"""
from kit import Model

BORE_Y = 0.031
SLIDE = dict(z_rear=0.028, z_front=-0.178, y_bottom=0.012, y_top=0.044, half=0.0118)
SIGHT_Y = 0.0495
MUZZLE_Z = -0.183
GRIP_TILT = -0.16
SLIDE_PIVOT = (0.0, BORE_Y, (SLIDE["z_rear"] + SLIDE["z_front"]) / 2)
HAMMER_PIVOT = (0.0, 0.016, 0.034)
MAG_WELL_POINT = (0.0, -0.1, 0.031)

POINTS = {
    "pt_muzzle": ((0.0, BORE_Y, MUZZLE_Z), None),
    "pt_ejectionPort": ((0.013, 0.037, -0.04), None),
    "pt_sightAnchor": ((0.0, SIGHT_Y, 0.35), None),
    "pt_rightHandGrip": ((0.0, -0.045, 0.022), None),
    "pt_leftHandGrip": ((-0.018, -0.05, 0.014), None),
    "pt_magWell": (MAG_WELL_POINT, None),
    "mount_optic": ((0.0, SLIDE["y_top"], -0.035), "slide"),
    "mount_muzzle": ((0.0, BORE_Y, SLIDE["z_front"] - 0.005), "slide"),
    "mount_magazine": (MAG_WELL_POINT, None),
}

SLIDE_PROFILE = [
    (0.026, SLIDE["y_top"]), (-0.174, SLIDE["y_top"]), (SLIDE["z_front"], 0.04), (SLIDE["z_front"], SLIDE["y_bottom"]),
    (0.03, SLIDE["y_bottom"]), (0.03, 0.03),
]
FRAME_PROFILE = [(0.026, SLIDE["y_bottom"]), (-0.15, SLIDE["y_bottom"]), (-0.152, 0.0), (-0.06, -0.002), (-0.055, -0.008), (0.0, -0.006), (0.026, -0.004)]
GRIP_PROFILE = [(0.0, 0.0), (0.03, 0.0), (0.044, -0.098), (0.04, -0.102), (0.02, -0.102), (0.017, -0.098)]
GRIP_PANEL = [(0.006, -0.016), (0.03, -0.016), (0.04, -0.092), (0.02, -0.094)]
GRIP_SAFETY = [(0.026, 0.012), (0.042, 0.018), (0.043, 0.012), (0.036, -0.004), (0.034, -0.026), (0.029, -0.02)]
HAMMER = [(-0.004, 0.0), (0.004, 0.0), (0.007, 0.02), (0.002, 0.026), (-0.004, 0.018)]


def models():
    return [("guns/p11_fp", detailed()), ("guns/p11_tp", simple())]


def add_points(m):
    # Parts must exist before points that hang on them.
    m.part("slide", SLIDE_PIVOT)
    for name, (pos, parent) in POINTS.items():
        m.point(name, pos, parent)


def magazine(m):
    mag = m.part("magazine", MAG_WELL_POINT)
    mag.box_at("metal", (0.019, 0.09, 0.024), (0.0, -0.055, 0.024), (GRIP_TILT, 0.0, 0.0))
    mag.box("metal", (-0.011, MAG_WELL_POINT[1] - 0.007, MAG_WELL_POINT[2] - 0.013), (0.011, MAG_WELL_POINT[1] - 0.001, MAG_WELL_POINT[2] + 0.013))
    return mag


def detailed():
    m = Model("p11_fp")
    add_points(m)
    b = m.body
    s = SLIDE

    # Frame, trigger guard (three bars), grip frame, mainspring housing, grip safety.
    b.profile("metal", FRAME_PROFILE, 0.021)
    b.box("metal", (-0.0055, -0.034, -0.062), (0.0055, -0.004, -0.052), bevel=0.001)
    b.box("metal", (-0.0055, -0.034, -0.058), (0.0055, -0.029, 0.006))
    b.box("metal", (-0.0055, -0.034, -0.006), (0.0055, -0.026, 0.006))
    b.profile("metal", GRIP_PROFILE, 0.024)
    b.profile("metal", GRIP_SAFETY, 0.018)
    b.box_at("metal", (0.02, 0.06, 0.006), (0.0, -0.068, 0.034), (GRIP_TILT, 0.0, 0.0))
    b.cyl("metal", 0.0028, 0.002, (0.0115, 0.008, -0.052), axis="x", segments=6)
    b.box("metal", (-0.0135, 0.008, 0.002), (-0.0115, 0.016, 0.024))
    b.box("metal", (-0.016, 0.012, 0.0), (-0.0115, 0.015, 0.008))

    # Wood grip panels with raised diamonds around the screws, both sides.
    for side in (1, -1):
        b.profile("gripWood", GRIP_PANEL, 0.003, center_x=side * 0.0135)
        for z, y in ((0.0205, -0.032), (0.028, -0.08)):
            b.box_at("gripWood", (0.0015, 0.013, 0.013), (side * 0.0155, y, z), (0.785 + GRIP_TILT, 0.0, 0.0))
            b.cyl("metal", 0.0025, 0.0012, (side * 0.0167, y, z), axis="x", segments=6)

    # --- Moving parts ---
    sl = m.part("slide", SLIDE_PIVOT)
    sl.profile("metal", SLIDE_PROFILE, s["half"] * 2)
    for i in range(7):
        z = i * 0.0035
        for side in (1, -1):
            sl.box_at("interior", (0.001, 0.026, 0.0016), (side * s["half"], 0.029, z))
    sl.box("interior", (s["half"] - 0.0004, 0.032, -0.065), (s["half"] + 0.0004, s["y_top"] - 0.002, -0.025))
    sl.box("metal", (s["half"], 0.036, -0.022), (s["half"] + 0.001, 0.04, 0.01))
    sl.cyl_z("metal", 0.0095, s["z_front"], s["z_front"] - 0.005, BORE_Y, segments=10)
    sl.cyl_z("metal", 0.0055, s["z_front"], s["z_front"] - 0.004, 0.0175, segments=8)
    sl.cyl_z("interior", 0.0045, s["z_front"] - 0.0045, s["z_front"] - 0.006, BORE_Y, segments=8)
    sl.box("metal", (-0.0015, s["y_top"], -0.17), (0.0015, SIGHT_Y + 0.0005, -0.162))
    sl.box("metal", (-0.008, s["y_top"], 0.012), (0.008, s["y_top"] + 0.002, 0.02))
    sl.box("metal", (-0.008, s["y_top"], 0.014), (-0.0015, SIGHT_Y + 0.001, 0.02))
    sl.box("metal", (0.0015, s["y_top"], 0.014), (0.008, SIGHT_Y + 0.001, 0.02))

    hp = HAMMER_PIVOT
    ham = m.part("hammer", hp)
    ham.profile("metal", [(z + hp[2], y + hp[1]) for z, y in HAMMER], 0.007)
    ham.cyl("metal", 0.005, 0.008, hp, axis="x", segments=8)
    m.part("trigger", (0.0, -0.006, -0.022)).box("metal", (-0.004, -0.02, -0.026), (0.004, -0.004, -0.02))
    ss = m.part("slideStop", (-0.0125, 0.008, -0.052))
    ss.cyl("metal", 0.003, 0.002, (-0.0125, 0.008, -0.052), axis="x", segments=6)
    ss.box("metal", (-0.0135, 0.006, -0.052), (-0.0115, 0.014, -0.022))
    ss.box("metal", (-0.016, 0.009, -0.03), (-0.0115, 0.016, -0.02))
    magazine(m)
    return m


def simple():
    m = Model("p11_tp")
    add_points(m)
    b = m.body
    b.profile("metal", FRAME_PROFILE, 0.021)
    b.profile("metal", GRIP_PROFILE, 0.024)
    b.box("metal", (-0.0055, -0.034, -0.058), (0.0055, -0.029, 0.006))
    b.profile("gripWood", GRIP_PANEL, 0.028)
    m.part("slide", SLIDE_PIVOT).profile("metal", SLIDE_PROFILE, SLIDE["half"] * 2)
    mw = MAG_WELL_POINT
    m.part("magazine", mw).box("metal", (-0.011, mw[1] - 0.007, mw[2] - 0.013), (0.011, mw[1] - 0.001, mw[2] + 0.013))
    return m
