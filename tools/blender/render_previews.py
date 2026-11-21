"""
Renders preview stills of the old man from a .blend made by old_man.py.

    blender -b old_man.blend -P tools/blender/render_previews.py -- out_dir "name:action:frame:view" ...

view is one of front, side, back, threeq, threeq_back. action "rest" means no animation.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
out_dir, shots = argv[0], argv[1:]
os.makedirs(out_dir, exist_ok=True)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.render.resolution_x = int(os.environ.get("RES", "480"))
scene.render.resolution_y = int(int(os.environ.get("RES", "480")) * 7 / 6)
scene.render.film_transparent = False
scene.view_settings.view_transform = "Standard"

world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.11, 0.12, 0.14, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
scene.world = world

# ground
bpy.ops.mesh.primitive_plane_add(size=8)
ground = bpy.context.object
gm = bpy.data.materials.new("sand")
gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.45, 0.25, 1)
ground.data.materials.append(gm)

sun = bpy.data.lights.new("sun", "SUN")
sun.energy = 3.2
so = bpy.data.objects.new("sun", sun)
so.rotation_euler = (math.radians(50), 0, math.radians(-35))
scene.collection.objects.link(so)
fill = bpy.data.lights.new("fill", "SUN")
fill.energy = 0.8
fo = bpy.data.objects.new("fill", fill)
fo.rotation_euler = (math.radians(60), 0, math.radians(150))
scene.collection.objects.link(fo)

cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 50
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

rig = bpy.data.objects["OldMan"]
VIEWS = {"front": (0, -1, 0.12), "side": (-1, 0, 0.12), "back": (0, 1, 0.12),
         "threeq": (-0.75, -0.75, 0.35), "threeq_back": (0.8, 0.6, 0.35), "low": (-0.85, -0.6, 0.12)}

for shot in shots:
    parts = shot.split(":")
    name, action, frame, view = parts[:4]
    if action == "rest":
        rig.animation_data.action = None
        for pb in rig.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
    else:
        rig.animation_data.action = bpy.data.actions[action]
    scene.frame_set(int(frame))
    target = Vector((0, 0, 0.92 if action in ("rest", "walk", "walk_idle") else 0.45))
    dist = 3.0
    if len(parts) > 4:  # optional close-up: target height and distance
        target, dist = Vector((0, 0, float(parts[4]))), float(parts[5])
    d = Vector(VIEWS[view]).normalized()
    cam.location = target + d * dist
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(out_dir, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("rendered", name)
