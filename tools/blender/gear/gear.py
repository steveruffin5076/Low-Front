"""
Gear held in the free hand: the quick knife and the smoke grenade. Origin at the grip (the
middle of the fist), the blade or the canister top along -Z.
"""
from kit import Model


def models():
    return [("gear/knife", knife()), ("gear/smoke", smoke())]


def knife():
    m = Model("knife")
    b = m.body
    # Handle with ridges, a small guard, a clip-point blade with a darker edge bevel.
    b.cyl_z("polymer", 0.012, 0.055, -0.045, 0.0, segments=8)
    for z in (0.03, 0.01, -0.01, -0.03):
        b.cyl_z("polymer", 0.0135, z + 0.003, z - 0.003, 0.0, segments=8)
    b.box("metal", (-0.007, -0.022, -0.052), (0.007, 0.02, -0.045), bevel=0.001)
    b.profile("bolt", [(-0.052, 0.012), (-0.2, 0.004), (-0.215, -0.004), (-0.17, -0.012), (-0.052, -0.014)], 0.004)
    b.profile("metal", [(-0.06, 0.012), (-0.18, 0.006), (-0.2, 0.004), (-0.06, 0.008)], 0.0045)
    return m


def smoke():
    m = Model("smoke")
    b = m.body
    b.cyl_z("green", 0.03, 0.06, -0.05, 0.0, segments=10)
    b.cyl_z("metal", 0.012, -0.05, -0.07, 0.0, segments=8)
    b.box("metal", (-0.004, 0.012, -0.07), (0.004, 0.032, -0.0))
    b.ring("metal", (0.016, -0.0), 0.009, 0.006, -0.064, -0.06, segments=8)
    b.box("tan", (-0.0305, -0.01, -0.02), (0.0305, 0.01, 0.02))
    return m
