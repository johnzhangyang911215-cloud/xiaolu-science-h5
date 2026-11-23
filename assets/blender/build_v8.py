"""V8: richer powder, authored viscous serum motion, refined studio materials."""
import bpy, math, random, json, array, ast
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent
ROOT=OUT.parent
bpy.ops.wm.open_mainfile(filepath=str(OUT/'inputs/鹿茸精华_细密粉末工程_v7.blend'))
sc=bpy.context.scene;sc.frame_set(0)
control_names=['PRODUCT_ROOT_FIXED_ORIENTATION','PRESS_CTRL','TAIL_SEPARATION_CTRL','HEAD_SEPARATION_CTRL','RING_WORLD_CTRL','CAMERA_LOCKED']
reference=[]
for f in range(601):
    sc.frame_set(f);bpy.context.view_layer.update()
    reference.append({n:list(v for row in bpy.data.objects[n].matrix_world for v in row) for n in control_names})
sc.frame_set(0)
root=bpy.data.objects['PRODUCT_ROOT_FIXED_ORIENTATION'];contents=bpy.data.objects['CONTENTS_CTRL']
fx=bpy.data.collections['02_CONTENTS_AND_FLOW']
axis=root.rotation_quaternion@Vector((0,0,1))
up=root.rotation_quaternion.inverted()@Vector((0,0,1))
mouth=root.matrix_world@Vector((0,0,1.32))
def smooth(a,b,t):
    u=max(0,min(1,(t-a)/(b-a)));return u*u*(3-2*u)
def curves_linear(owner):
    if not owner.animation_data or not owner.animation_data.action:return
    for layer in owner.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='CONSTANT' if curve.data_path=='hide_render' else 'LINEAR'
def pmat(name,**kwargs):
    m=bpy.data.materials[name];p=m.node_tree.nodes['Principled BSDF']
    for socket,value in kwargs.items():p.inputs[socket].default_value=value
    return m,p

# Subtle satin polymer, brighter neutral highlights and controlled grey tail.
for name,color,rough,coat,trans,sss in [
    ('MAT_Frosted_shell_cutaway',(.87,.89,.91,1),.245,.26,.09,.035),
    ('MAT_Head_cap',(.88,.90,.92,1),.225,.29,.065,.04),
    ('MAT_Safety_ring',(.82,.87,.90,1),.22,.23,.18,0),
    ('MAT_Grey_tail_cutaway',(.36,.39,.43,1),.235,.34,0,0),
    ('MAT_Visible_shell_rims',(.79,.84,.88,1),.20,.25,.055,0),
]:
    m,p=pmat(name,**{'Base Color':color,'Roughness':rough,'Coat Weight':coat,'Coat Roughness':.15,'Transmission Weight':trans,'Subsurface Weight':sss,'IOR':1.46})
    for n in m.node_tree.nodes:
        if n.type=='BUMP':n.inputs['Strength'].default_value=.045;n.inputs['Distance'].default_value=.005

for name in ['FXMAT_Clear_serum','FXMAT_Serum_jet']:
    m,p=pmat(name,**{'Base Color':(.91,.965,.99,1),'IOR':1.40,'Transmission Weight':.68 if name.endswith('jet') else .54,'Coat Weight':.32,'Coat Roughness':.045,'Roughness':.05,'Alpha':1.0 if name.endswith('jet') else .36})
    if name=='FXMAT_Clear_serum':m.node_tree.animation_data_clear()
    m['V8_note']='Optical refinement only; viscosity is represented by geometry and motion, not IOR.'

for name,loc,energy,sx,sy,color in [
    ('LIGHT_Key',(-4.2,-5.4,5.8),1200,2.4,7.5,(1,.97,.935)),
    ('LIGHT_Fill',(4.5,-4,0.5),340,4.0,7.0,(.88,.94,1)),
    ('LIGHT_Rim',(2.5,2.8,4.4),1450,1.6,8.0,(.85,.93,1)),
    ('LIGHT_LiquidStrip_V8',(-3.4,1.4,-3.8),450,1.2,5.0,(.90,.96,1)),
]:
    ob=bpy.data.objects.get(name)
    if ob is None:
        data=bpy.data.lights.new(name,'AREA');ob=bpy.data.objects.new(name,data);bpy.data.collections['04_FIXED_CAMERA_AND_LIGHTS'].objects.link(ob)
    ob.location=loc;ob.data.energy=energy;ob.data.shape='RECTANGLE';ob.data.size=sx;ob.data.size_y=sy;ob.data.color=color
    ob.rotation_euler=(Vector((0,0,.5))-ob.location).to_track_quat('-Z','Y').to_euler()
sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.23

# Replace V7 powder with 3x as many grains; retain fine, visible granularity.
old=bpy.data.objects.get('FX_DenseMicroPowder_V7')
if old:bpy.data.objects.remove(old,do_unlink=True)
rng=random.Random(813);count=14400;seeds=[]
for i in range(count):
    a=rng.uniform(0,math.tau);r=.38*math.sqrt(rng.random())
    initial=(r*math.cos(a),r*math.sin(a),rng.uniform(-4.58,-4.10))
    theta=rng.uniform(0,math.tau);rad=.62*math.sqrt(rng.random())
    dest=(rad*math.cos(theta),rad*math.sin(theta),rng.uniform(-1.10,.72))
    size=rng.uniform(.0055,.0115)
    seeds.append((initial,dest,size,rng.uniform(0,.7),theta))
def powder_positions(t):
    coords=[];press=.48*smooth(3.3,4,t)
    churn=math.sin(math.pi*(t-6.5)/4)**2 if 6.5<t<10.5 else 0
    for initial,dest,size,delay,theta in seeds:
        release=smooth(4.22+delay*.5,6.35+delay*.5,t)
        x=initial[0]+(dest[0]-initial[0])*release
        y=initial[1]+(dest[1]-initial[1])*release
        z=initial[2]+press+(dest[2]-initial[2]-press)*release
        pulse=math.sin(math.pi*release)
        x+=.13*pulse*math.sin(3*t+theta);y+=.11*pulse*math.cos(3*t+theta)
        rot=.38*churn*math.sin(3.8*t+theta)
        x,y=x*math.cos(rot)-y*math.sin(rot),x*math.sin(rot)+y*math.cos(rot)
        z+=.14*churn*math.sin(8.5*t+theta)
        amount=1-smooth(7.35+delay*.15,10.0+delay*.4,t)
        s=size*amount**.65 if amount>.002 else 0
        radius=math.hypot(x,y)
        # Inset grains from the narrowing shoulder as well as the cylindrical wall.
        limit=min(.715,.756-1.25*max(0,z-.55))-size*1.2
        if z>=-2.72 and radius>limit:x*=limit/radius;y*=limit/radius
        for dx,dy,dz in [(1,0,-.42),(-.5,.866,-.42),(-.5,-.866,-.42),(0,0,1)]:
            xx=(dx*math.cos(theta)-dy*math.sin(theta))*s
            yy=(dx*math.sin(theta)+dy*math.cos(theta))*s*.8
            coords.extend((x+xx,y+yy,z+dz*s))
    return array.array('f',coords)
faces=[]
for i in range(count):
    n=i*4;faces.extend([(n,n+2,n+1),(n,n+1,n+3),(n+1,n+2,n+3),(n+2,n,n+3)])
co=powder_positions(3)
me=bpy.data.meshes.new('PowderCloud_14400');me.from_pydata(list(zip(co[::3],co[1::3],co[2::3])),[],faces);me.update()
powder=bpy.data.objects.new('FX_DenseMicroPowder_V8',me);fx.objects.link(powder);powder.parent=contents;me.materials.append(bpy.data.materials['FXMAT_White_fine_powder'])
powder.shape_key_add(name='Basis')
for f in range(90,316,3):
    k=powder.shape_key_add(name=f'powder_{f:04d}');k.data.foreach_set('co',powder_positions(f/30))
    for at,value in [(f-3,0),(f,1),(f+3,0)]:k.value=value;k.keyframe_insert(data_path='value',frame=at)
for f in range(601):
    powder.hide_render=not 90<=f<312;powder.keyframe_insert(data_path='hide_render',frame=f)
curves_linear(powder);curves_linear(powder.data.shape_keys)
powder['particle_count']=count;powder['grain_radius_range']=[.0055,.0115]

# Keep the fitted bottle volume topology and gravity-aligned surface.
source=ast.parse((OUT/'inputs/build_effects.py').read_text())
for fn in ['radius','center_level','liquid_verts','bake_shapes']:
    node=next(n for n in source.body if isinstance(n,ast.FunctionDef) and n.name==fn)
    exec(compile(ast.Module(body=[node],type_ignores=[]),str(OUT/'inputs/build_effects.py'),'exec'))
N=64;RINGS=28;CAPRINGS=6
def topz(x,y,t):
    z=center_level(t)-(up.x*x+up.y*y)/up.z
    if 6.5<t<10.5:
        env=math.sin(math.pi*(t-6.5)/4)**2
        # Broad, delayed surface motion instead of fine watery ripples.
        z+=.065*env*math.sin(12.5*(t-.14))*(.75*x+.28*y)
        z+=.012*env*math.sin(5.5*t+1.8*x)
    return z
liquid=bpy.data.objects['FX_Serum_ConformalVolume'];liquid.shape_key_clear()
for v,co in zip(liquid.data.vertices,liquid_verts(0)):v.co=co
bake_shapes(liquid,liquid_verts,list(range(0,601,3)));curves_linear(liquid.data.shape_keys)
for f in range(601):
    t=f/30;haze=smooth(4.7,6.3,t)*(1-smooth(8.2,10.25,t))
    p=bpy.data.materials['FXMAT_Clear_serum'].node_tree.nodes['Principled BSDF']
    for name,value in [('Alpha',.32+.10*haze),('Roughness',.045+.045*haze)]:
        p.inputs[name].default_value=value;p.inputs[name].keyframe_insert(data_path='default_value',frame=f)
curves_linear(bpy.data.materials['FXMAT_Clear_serum'].node_tree)

# Slower, fuller continuous strand with short stretching and rounded final drops.
JN=16;JS=56
def jet_verts(t):
    start=12.;stop=14.12;maxage=2.20
    amin=max(0,t-stop);amax=min(maxage,max(0,t-start))
    if amin>=amax:amin=0;amax=.0001
    verts=[]
    for j in range(JS+1):
        u=j/JS;age=amin+(amax-amin)*u;emitted=t-age
        center=mouth+axis*(.36*age)+Vector((.005*math.sin(5*age+2*t)*age,0,-2.15*age*age))
        tangent=(axis*.36+Vector((0,0,-4.3*age))).normalized()
        side=tangent.cross(Vector((0,1,0))).normalized();side2=tangent.cross(side).normalized()
        gate=smooth(12,12.35,emitted)*(1-smooth(13.82,14.12,emitted))
        rr=.116*(.36/(.36+4.3*age))**.28*gate*(1+.022*math.sin(9*emitted))
        if j in (0,JS) and age>.001:rr*=.2
        rr=max(.00003,rr)
        for k in range(JN):
            a=math.tau*k/JN;verts.append(tuple(center+rr*(math.cos(a)*side+math.sin(a)*side2)))
    return verts
jet=bpy.data.objects['FX_FallingSerumJet'];jet.shape_key_clear()
for v,co in zip(jet.data.vertices,jet_verts(0)):v.co=co
bake_shapes(jet,jet_verts,list(range(0,601,3)));curves_linear(jet.data.shape_keys)
for f in range(601):
    t=f/30;jet.hide_render=not 12<t<16.32;jet.keyframe_insert(data_path='hide_render',frame=f)
    for i in range(3):
        ob=bpy.data.objects[f'FX_LastDrop_{i:02d}'];birth=[14.24,14.56,14.89][i];age=t-birth
        visible=-.22<age<2.10;ob.hide_render=not visible;ob.keyframe_insert(data_path='hide_render',frame=f)
        u=max(0,age);grow=smooth(-.22,0,age)
        ob.location=mouth+axis*(.055+.16*grow+.20*u)+Vector((0,0,-.025-2.15*u*u))
        size=[.105,.086,.067][i]*grow
        ob.scale=(size,size,size*(1.10+.82*math.exp(-11*u)))
        if t>=17:ob.location=mouth;ob.scale=(0,0,0)
        ob.keyframe_insert(data_path='location',frame=f);ob.keyframe_insert(data_path='scale',frame=f)
curves_linear(jet)
for i in range(3):curves_linear(bpy.data.objects[f'FX_LastDrop_{i:02d}'])

sc.render.engine='CYCLES';sc.cycles.samples=96;sc.cycles.adaptive_min_samples=24;sc.cycles.adaptive_threshold=.02
sc.cycles.use_denoising=True;sc.cycles.use_animated_seed=False;sc.cycles.seed=23
sc.cycles.max_bounces=10;sc.cycles.transmission_bounces=8;sc.cycles.transparent_max_bounces=20
sc.render.use_persistent_data=False
sc.render.resolution_x=1080;sc.render.resolution_y=1920;sc.render.resolution_percentage=100
sc['revision_v8']='14400 fine grains, fuller slower serum strand, delayed meniscus motion, larger rounded drops, satin polymer and four-light studio, Cycles 96 adaptive samples.'
sc['effect_method']='Authored procedural visualization; no calibrated physical viscosity or CFD claim.'
sc['README']='20-second 30fps fixed-camera loop. All V7 assembly actions preserved; editable materials, lights and baked effects.'
maxerr=0
for f in range(601):
    sc.frame_set(f);bpy.context.view_layer.update()
    for n in control_names:
        current=[v for row in bpy.data.objects[n].matrix_world for v in row]
        maxerr=max(maxerr,max(abs(a-b) for a,b in zip(current,reference[f][n])))
assert maxerr<1e-6
sc.frame_set(0);sc.render.filepath='//frames/frame_'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'鹿茸精华_材质与浓稠精华工程_v8.blend'))
report={'frames_checked':601,'camera_and_assembly_max_error':maxerr,'powder_count':14400,'v7_powder_count':4800,'powder_radius':[.0055,.0115],'render_samples':96,'persistent_cache':False,'method':'Authored effects; not calibrated fluid simulation'}
(OUT/'build_validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('V8_BUILD_COMPLETE',json.dumps(report),flush=True)
