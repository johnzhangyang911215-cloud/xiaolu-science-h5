# Functions imported by build_v8.py from the original liquid animation.
def radius(z):
    # Liquid is inset from the actual refined inner-wall profile.
    profile=[(-3,.756),(.55,.756),(.68,.738),(.78,.654),(1.03,.358),(1.12,.305),(1.31,.291)]
    for (a,r),(b,s) in zip(profile,profile[1:]):
        if a<=z<=b:return r+(s-r)*(z-a)/(b-a)
    return profile[0][1] if z<profile[0][0] else profile[-1][1]

def center_level(t):
    drain=smooth(12,14.7,t)*(1-smooth(17.1,17.7,t))
    return -1.58+2.00*drain

def liquid_verts(t):
    verts=[];edge=[]
    for i in range(N):
        a=math.tau*i/N;z=center_level(t)
        for _ in range(5):r=radius(z);x=r*math.cos(a);y=r*math.sin(a);z=topz(x,y,t)
        edge.append((x,y,z))
    for j in range(RINGS+1):
        u=j/RINGS
        for i,(x,y,z0) in enumerate(edge):
            z=z0+(1.308-z0)*u;a=math.tau*i/N;r=radius(z)
            verts.append((r*math.cos(a),r*math.sin(a),z))
    # Top concentric rings give a small meniscus and waves without flat n-gon shading.
    for j in range(1,CAPRINGS):
        q=1-j/CAPRINGS
        for x,y,z in edge:
            xx=x*q;yy=y*q
            zz=topz(xx,yy,t)-.014*q**8
            verts.append((xx,yy,zz))
    verts.append((0,0,topz(0,0,t)))
    verts.append((0,0,1.308))
    return verts

def bake_shapes(ob,func,frames):
    ob.shape_key_add(name='Basis')
    previous=None
    for f in frames:
        k=ob.shape_key_add(name='t_%04d'%f)
        for v,co in zip(k.data,func(f/30)):v.co=co
        k.value=0;k.keyframe_insert(data_path='value',frame=max(0,f-3))
        k.value=1;k.keyframe_insert(data_path='value',frame=f)
        k.value=0;k.keyframe_insert(data_path='value',frame=min(600,f+3))
    # Consecutive triangular influence curves sum to one; boundary values are set explicitly.
    first=ob.data.shape_keys.key_blocks['t_%04d'%frames[0]]
    first.value=1;first.keyframe_insert(data_path='value',frame=frames[0])
    last=ob.data.shape_keys.key_blocks['t_%04d'%frames[-1]]
    last.value=1;last.keyframe_insert(data_path='value',frame=frames[-1])
