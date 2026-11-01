"""
Gunsmith attachments (generic names, no real products). Each model's origin is the seat on the
gun's mount (mount_<slot>), in game coordinates: +Y up, the muzzle along -Z.

Points the game reads:
- optics: pt_sightLine, the center of the sight window (the eye lines up behind it);
- muzzle devices: pt_muzzle, the new muzzle (flash, tracers);
- grips: pt_leftHandGrip, where the left hand holds;
- magazines: a "magazine" part that replaces the gun's magazine node (same pivot: the mag well).
"""
from kit import Model

# VX-4 iron sight line is 39 mm over the rail top; the mount sits 3 mm up on the rail ridges.
SIGHT_H = 0.036
MAG_PROFILE = [
    (0.03, 0.045), (-0.03, 0.045), (-0.031, 0.0), (-0.036, -0.06), (-0.046, -0.115), (-0.05, -0.124),
    (-0.016, -0.13), (0.008, -0.12), (0.02, -0.06), (0.028, 0.0),
]


def models():
    return [
        ("attachments/reddot", red_dot()),
        ("attachments/holo", holo()),
        ("attachments/scope3x", scope3x()),
        ("attachments/suppressor", suppressor()),
        ("attachments/compensator", compensator()),
        ("attachments/vgrip", vertical_grip()),
        ("attachments/agrip", angled_grip()),
        ("attachments/extmag", extended_mag()),
    ]


def rail_clamp(b, z0, z1, height=0.008, width=0.026):
    """Clamp that sits on the rail: a base with a thumb nut on the left side."""
    b.box("metal", (-width / 2, 0.0, z0), (width / 2, height, z1), bevel=0.0015)
    b.cyl("metal", 0.004, 0.006, (-width / 2 - 0.003, height * 0.4, (z0 + z1) / 2), axis="x", segments=8)


def red_dot():
    m = Model("reddot")
    b = m.body
    rail_clamp(b, -0.022, 0.018)
    # Riser up to the sight line, then a short round tube with a hood.
    b.box("metal", (-0.009, 0.008, -0.016), (0.009, SIGHT_H - 0.013, 0.012), bevel=0.002)
    b.ring("metal", (0.0, SIGHT_H), 0.017, 0.0135, -0.022, 0.016, segments=14)
    b.ring("metal", (0.0, SIGHT_H), 0.0175, 0.0135, -0.026, -0.022, segments=14)
    # Brightness and windage turrets.
    b.cyl("metal", 0.0045, 0.008, (0.019, SIGHT_H, -0.003), axis="x", segments=8)
    b.cyl("metal", 0.0045, 0.008, (0.0, SIGHT_H + 0.019, -0.003), axis="y", segments=8)
    # The reticle: a small red dot on the front lens.
    b.box("dot", (-0.0006, SIGHT_H - 0.0006, -0.0205), (0.0006, SIGHT_H + 0.0006, -0.0195))
    m.point("pt_sightLine", (0.0, SIGHT_H, -0.003))
    return m


def holo():
    m = Model("holo")
    b = m.body
    rail_clamp(b, -0.03, 0.03, width=0.03)
    # Battery housing and a square window with a frame.
    b.box("metal", (-0.015, 0.008, -0.012), (0.015, SIGHT_H - 0.015, 0.03), bevel=0.003)
    hw, hh, z0, z1 = 0.017, 0.015, -0.03, -0.008
    b.box("metal", (-hw - 0.003, SIGHT_H - hh - 0.003, z0), (hw + 0.003, SIGHT_H - hh, z1))
    b.box("metal", (-hw - 0.003, SIGHT_H + hh, z0), (hw + 0.003, SIGHT_H + hh + 0.003, z1), bevel=0.001)
    b.box("metal", (-hw - 0.003, SIGHT_H - hh, z0), (-hw, SIGHT_H + hh, z1))
    b.box("metal", (hw, SIGHT_H - hh, z0), (hw + 0.003, SIGHT_H + hh, z1))
    # Reticle: a ring with a center dot, on the front glass.
    b.ring("dot", (0.0, SIGHT_H), 0.0048, 0.0042, -0.0285, -0.0280, segments=16)
    b.box("dot", (-0.0005, SIGHT_H - 0.0005, -0.0285), (0.0005, SIGHT_H + 0.0005, -0.028))
    m.point("pt_sightLine", (0.0, SIGHT_H, -0.02))
    return m


def scope3x():
    m = Model("scope3x")
    b = m.body
    h = SIGHT_H + 0.009
    for z in (-0.035, 0.03):
        rail_clamp(b, z - 0.008, z + 0.008, width=0.024)
        b.box("metal", (-0.006, 0.008, z - 0.006), (0.006, h - 0.012, z + 0.006))
        b.ring("metal", (0.0, h), 0.0145, 0.0125, z - 0.007, z + 0.007, segments=12)
    b.cyl_z("metal", 0.0125, -0.07, 0.065, h, segments=12)
    b.cyl("metal", 0.0125, 0.03, (0.0, h, -0.085), "z", segments=12, radius_end=0.0125)
    b.cyl("metal", 0.019, 0.03, (0.0, h, -0.085), "z", segments=12, radius_end=0.0125)
    b.cyl_z("metal", 0.019, -0.1, -0.13, h, segments=12)
    b.cyl("metal", 0.0125, 0.02, (0.0, h, 0.075), "z", segments=12, radius_end=0.016)
    b.cyl_z("metal", 0.016, 0.085, 0.11, h, segments=12)
    b.cyl("metal", 0.0065, 0.012, (0.0, h + 0.016, 0.0), axis="y", segments=8)
    b.cyl("metal", 0.0065, 0.012, (0.016, h, 0.0), axis="x", segments=8)
    b.cyl_z("glass", 0.017, -0.1305, -0.128, h, segments=12)
    b.cyl_z("glass", 0.0145, 0.1085, 0.111, h, segments=12)
    m.point("pt_sightLine", (0.0, h, 0.11))
    return m


def suppressor():
    m = Model("suppressor")
    b = m.body
    b.cyl_z("metal", 0.0095, 0.0, -0.012, 0.0, segments=10)
    b.cyl_z("tan", 0.0165, -0.012, -0.165, 0.0, segments=12)
    for z in (-0.02, -0.157):
        b.cyl_z("metal", 0.017, z, z - 0.006, 0.0, segments=12)
    b.cyl_z("interior", 0.005, -0.1655, -0.163, 0.0, segments=8)
    m.point("pt_muzzle", (0.0, 0.0, -0.165))
    return m


def compensator():
    m = Model("compensator")
    b = m.body
    b.cyl_z("metal", 0.011, 0.0, -0.055, 0.0, segments=10)
    # Ports on the top and sides vent gas to push the muzzle down and steady.
    for z in (-0.02, -0.033, -0.046):
        b.box("interior", (-0.004, 0.0095, z - 0.0035), (0.004, 0.0112, z + 0.0035))
        for side in (-1, 1):
            b.box("interior", (side * 0.0103 - 0.0009, -0.003, z - 0.0035), (side * 0.0103 + 0.0009, 0.003, z + 0.0035))
    b.cyl_z("interior", 0.0045, -0.0555, -0.053, 0.0, segments=8)
    m.point("pt_muzzle", (0.0, 0.0, -0.055))
    return m


def vertical_grip():
    m = Model("vgrip")
    b = m.body
    # Clamp under the rail (the mount is the rail's underside), then a grip with finger ridges.
    b.box("polymer", (-0.012, -0.008, -0.018), (0.012, 0.0, 0.018), bevel=0.0015)
    b.cyl("polymer", 0.0125, 0.075, (0.0, -0.045, 0.0), axis="y", segments=10, radius_end=0.0115)
    for y in (-0.03, -0.045, -0.06):
        b.cyl("polymer", 0.0135, 0.004, (0.0, y, 0.0), axis="y", segments=10)
    b.cyl("polymer", 0.0145, 0.006, (0.0, -0.084, 0.0), axis="y", segments=10)
    m.point("pt_leftHandGrip", (0.0, -0.045, 0.0))
    return m


def angled_grip():
    m = Model("agrip")
    b = m.body
    # A sloped wedge that the palm pushes against, thumb on top.
    b.profile("polymer", [(0.03, 0.0), (-0.03, 0.0), (-0.034, -0.008), (0.012, -0.03), (0.026, -0.03), (0.034, -0.008)], 0.022)
    b.box("polymer", (-0.012, -0.004, -0.03), (0.012, 0.0, 0.03))
    m.point("pt_leftHandGrip", (0.0, -0.018, 0.012))
    return m


def extended_mag():
    """40 rounds: longer and more curved than the standard 30-round magazine."""
    m = Model("extmag")
    k = 1.33
    # Stretch the part below the well and curve it a little further forward (-Z).
    pts = [(z - (0.012 * (-y / 0.13) if y < 0 else 0.0), y * (k if y < 0 else 1.0)) for z, y in MAG_PROFILE]
    mag = m.part("magazine")
    mag.profile("metal", pts, 0.022)
    bottom_y = -0.13 * k
    mag.box("polymer", (-0.0135, bottom_y - 0.007, -0.07), (0.0135, bottom_y + 0.002, 0.004), bevel=0.002)
    for x in (-0.0115, 0.0115):
        mag.box("metal", (x - 0.0006, -0.13, -0.05), (x + 0.0006, -0.01, -0.035))
    return m

