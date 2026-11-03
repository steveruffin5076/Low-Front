"""
Gunsmith parts made for one gun (or one kind of gun). Same conventions as catalog.py: the origin
is the seat on the gun's mount, game coordinates. A key "attachments/<id>_<gun>" is used on that
gun instead of the generic "attachments/<id>".
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "guns"))

from kit import Model  # noqa: E402

import kr7  # noqa: E402
import sr9  # noqa: E402

MINI_H = 0.017


def models():
    return [
        ("attachments/minidot", mini_dot()),
        ("attachments/suppressor_p11", pistol_suppressor()),
        ("attachments/choke", choke()),
        ("attachments/tubeext", tube_extension()),
        ("attachments/bipod", bipod()),
        ("attachments/extmag_kr7", extmag_kr7()),
        ("attachments/extmag_sr9", extmag_sr9()),
        ("attachments/extmag_lr24", extmag_lr24()),
        ("attachments/extmag_p11", extmag_p11()),
    ]


def mini_dot():
    """Small open red dot cut into the pistol slide."""
    m = Model("minidot")
    b = m.body
    b.box("metal", (-0.0105, 0.0, -0.022), (0.0105, 0.006, 0.012), bevel=0.0015)
    # Open window: a sloped front frame and a thin hood, the dot on the front glass.
    b.box("metal", (-0.0105, 0.006, -0.022), (-0.008, MINI_H + 0.009, -0.016))
    b.box("metal", (0.008, 0.006, -0.022), (0.0105, MINI_H + 0.009, -0.016))
    b.box("metal", (-0.0105, MINI_H + 0.007, -0.022), (0.0105, MINI_H + 0.01, -0.016))
    b.box("glass", (-0.008, 0.006, -0.0195), (0.008, 0.0075, -0.0185))
    b.box("dot", (-0.0005, MINI_H - 0.0005, -0.0196), (0.0005, MINI_H + 0.0005, -0.0186))
    b.box("metal", (-0.0105, 0.006, 0.002), (0.0105, 0.009, 0.012))
    m.point("pt_sightLine", (0.0, MINI_H, -0.01))
    return m


def pistol_suppressor():
    m = Model("suppressor_p11")
    b = m.body
    b.cyl_z("metal", 0.007, 0.0, -0.008, 0.0, segments=10)
    b.cyl_z("polymer", 0.0135, -0.008, -0.118, 0.0, segments=12)
    for z in (-0.012, -0.112):
        b.cyl_z("metal", 0.014, z, z - 0.005, 0.0, segments=12)
    b.cyl_z("interior", 0.0045, -0.1185, -0.116, 0.0, segments=8)
    m.point("pt_muzzle", (0.0, 0.0, -0.118))
    return m


def choke():
    """Extended choke tube: tighter pellet pattern."""
    m = Model("choke")
    b = m.body
    b.cyl_z("metal", 0.0125, 0.0, -0.038, 0.0, segments=12)
    for z in (-0.012, -0.022, -0.032):
        for side in (-1, 1):
            b.box("interior", (side * 0.0122 - 0.0009, -0.004, z - 0.003), (side * 0.0122 + 0.0009, 0.004, z + 0.003))
    b.cyl_z("interior", 0.0085, -0.0385, -0.036, 0.0, segments=10)
    m.point("pt_muzzle", (0.0, 0.0, -0.038))
    return m


def tube_extension():
    """Two more shells: a longer magazine tube clamped to the barrel."""
    m = Model("tubeext")
    b = m.body
    b.cyl_z("metal", 0.012, 0.0, -0.085, 0.0, segments=10)
    b.cyl_z("metal", 0.0135, -0.085, -0.095, 0.0, segments=10)
    # Barrel clamp: the barrel is 30 mm above the tube.
    b.box("metal", (-0.009, 0.0, -0.07), (0.009, 0.03, -0.055), bevel=0.0015)
    b.ring("metal", (0.0, 0.03), 0.0145, 0.0115, -0.07, -0.055, segments=10)
    return m


def bipod():
    """Folding bipod on the forend sling stud, legs folded forward."""
    m = Model("bipod")
    b = m.body
    b.box("metal", (-0.012, -0.012, -0.015), (0.012, 0.0, 0.015), bevel=0.002)
    b.cyl("metal", 0.004, 0.032, (0.0, -0.01, 0.0), axis="x", segments=8)
    for x in (-0.013, 0.013):
        b.box("metal", (x - 0.003, -0.016, -0.17), (x + 0.003, -0.008, 0.005))
        b.box("polymer", (x - 0.004, -0.018, -0.18), (x + 0.004, -0.006, -0.165))
    return m


def extmag_kr7():
    m = Model("extmag_kr7")
    m.part("magazine").profile("metal", kr7.mag_profile(stretch=1.0, extra_sweep=0.17), 0.024)
    return m


def extmag_sr9():
    m = Model("extmag_sr9")
    pts = [(z - (0.012 * (-y / 0.155) if y < 0 else 0.0), y * (1.3 if y < 0 else 1.0)) for z, y in sr9.MAG_PROFILE]
    m.part("magazine").profile("metal", pts, 0.022)
    return m


def extmag_lr24():
    """Ten rounds: a deeper box magazine."""
    m = Model("extmag_lr24")
    m.part("magazine").box("metal", (-0.012, -0.055, -0.03), (0.012, 0.03, 0.03), bevel=0.0015)
    return m


def extmag_p11():
    """Ten rounds: a longer magazine with a base pad below the grip."""
    m = Model("extmag_p11")
    mag = m.part("magazine")
    tilt = -0.16
    mag.box_at("metal", (0.019, 0.112, 0.024), (0.0, 0.034, -0.0055), (tilt, 0.0, 0.0))
    mag.box_at("polymer", (0.024, 0.014, 0.03), (0.0, -0.026, -0.0155), (tilt, 0.0, 0.0))
    return m
