# Procesador de Imágenes WebGPU

Esta aplicación web permite cargar, visualizar, procesar y exportar imágenes usando filtros y operaciones avanzadas, aprovechando la aceleración de WebGPU. Soporta múltiples formatos, compresión RLE y visualización de histogramas y curvas de perfil.

## Características principales

- **Carga de imágenes**: Soporta imágenes estándar (PNG, JPG, BMP) y formatos Netpbm (PBM, PGM, PPM) y RLE.
- **Procesamiento acelerado**: Filtros y operaciones implementados con WebGPU y shaders WGSL.
- **Filtros disponibles**: Promedio, Mediana, Gaussiano, Prewitt, Sobel, Roberts, Sharpen, Negativo, Escala de grises, Umbral simple y múltiple, Flip horizontal y vertical, Rotación en múltiplos de 90°, Zoom, Gamma, Brillo, Contraste, Escala de color personalizada y Kernel personalizado.
- **Exportación**: Guarda imágenes en formatos Netpbm (PBM, PGM, PPM), PNG, BMP y Netpbm comprimido con RLE (.rle).
- **Visualización**: Histogramas RGB y de canales, curva tonal y curva de perfil de línea.

## Uso

1. **Carga de imagen**: Haz clic en "Load Image" y selecciona una imagen (soporta .png, .jpg, .bmp, .pbm, .pgm, .ppm, .rle).
2. **Aplicar filtros**: Usa el menú lateral para seleccionar y configurar filtros. Algunos filtros permiten elegir el tamaño del kernel o la dirección (por ejemplo, Prewitt).
3. **Exportar**: Usa los botones "Save Netpbm", "Save PNG", "Save BMP" o "Save RLE" para guardar la imagen procesada en el formato deseado.
4. **Visualización**: Observa los diferentes histogramas (RGB, R, G y B), la curva tonal y la curva de perfil de línea en la interfaz. Los histogramas y la curva tonal se encuentran en la barra lateral derecha de la interfaz y la curva de perfil de línea de la imagen se muestra por debajo de la imagen (hacer scroll).

## Compresión y carga RLE
- Al guardar en formato RLE, la imagen Netpbm se comprime usando Run-Length Encoding (RLE) y se guarda con extensión `.rle`.
- Puedes volver a cargar archivos `.rle` en la aplicación; serán descomprimidos y visualizados automáticamente.

## Requisitos
- Navegador moderno con soporte para WebGPU (Chrome Canary, Edge Dev, etc.).
- JavaScript habilitado.

## Estructura del proyecto
- `index.html`: Interfaz principal y menú de filtros.
- `action.js`: Lógica de procesamiento, filtros, exportación y carga.
- `canvastobmp.js`: Librería para exportación a BMP.
- `style.css`: Estilos de la interfaz.
- `assets`: Imágenes de ejemplo para pruebas.
- `assets/exported/`: Imágenes exportadas.

## Notas
- La aplicación y carga de imágenes funciona sin la necesidad de un servidor (en las pruebas hechas en los navegadores Google Chrome y Microsoft Edge), sin embargo, se dejó en el directorio `src` un archivo llamado `app.js`, el cual permite ejecutar un `localhost` con `node.js`. En caso de necesitarlo, solo tendría que, desde la terminal de comandos ubicado en el directorio `src`, ejecutar el siguiente comando: `node app.js`, y posteriormente abrir la aplicación en `http://localhost:3000`.
- Algunos filtros requieren seleccionar parámetros antes de aplicar.
- Los filtros u operadores que tienen el nombre o título subrayado significa que para aplicarlo o generar la acción se tiene que hacer click sobre el nombre o título en cuestión para que se ejecute.
- En el caso de "Umbral múltiple" se debe colocar diferentes valores para crear intervalos para la umbralización, en el formato "0.1, 0.2, 0.3, 0.5, ...", en este caso cada intervalo tendrá un valor ya sea 0 o 1 (negro o blanco), y el valor se irá asignando sucesivamente entre cada intervalo, es decir, para el primer intervalo el color asignado será 0 (negro), para el segundo intervalo será 1 (blanco) y así sucesivamente.
- En la opción de "Rotar" tiene 2 botones para rotar n ángulos de 90° y -90°, es decir, ángulo recto hacia la izquierda o derecha, aunque también tiene un input en donde puede agregar un ángulo personalizado, sin embargo, este ángulo personalizado se ajutará al ángulo recto más cercano, es decir, que si ingresa un ángulo de 185°, el input automáticamente lo ajustará a 180° y ese es el ángulo que se aplicará a la rotación.
- El procesamiento se realiza sobre la imagen cargada o el resultado del último filtro aplicado.
- El formato Netpbm exportado es ASCII (P1, P2, P3).
- La compresión RLE solo afecta el cuerpo de datos, no el encabezado Netpbm.
- Para la última opción del menú que es la del Kernel personalizado, se estableció un máximo de 7x7, en ese sentido se puede hacer todas las combinaciones de kernels que se desee siempre y cuando no supere esas dimensiones. Los valores a ingresar en los inputs deben ser valores numéricos.

## Autor
- Johan Quinter - Proyecto de la materia Procesamiento Digital de Imágenes - Postgrado UCV

## Enlace al repositorio en GitHub
https://github.com/johanQ10/pdi_project
