# 地球贴图来源

| 文件 | 来源 | 说明 |
| --- | --- | --- |
| `day.jpg` | three.js r160 `examples/textures/planets/earth_atmos_2048.jpg` | 日面颜色，2048×1024 等距圆柱投影 |
| `lights.jpg` | three.js r160 `examples/textures/planets/earth_lights_2048.png`（转存为 JPEG） | 夜面城市灯光 |
| `ocean.jpg` | three.js r160 `examples/textures/planets/earth_specular_2048.jpg` | 海洋为白、陆地为黑；同时用作程序化地形的陆地遮罩 |

下载地址：`https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/textures/planets/`。这些贴图由 NASA Blue Marble / Black Marble 公有领域影像派生，随 three.js 示例分发。

分镜要求的 NASA 原始贴图（eoimages.gsfc.nasa.gov）在制作时无法连接（`curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL`），预演阶段先用上述派生版本；落版前可替换为 NASA 原图，文件名不变即可。
