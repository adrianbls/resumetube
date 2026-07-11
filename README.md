# ResumeTube

Extensión para Firefox que obtiene la transcripción visible de un vídeo de
YouTube, construye un prompt seguro para resumirla y abre el chat de IA elegido
por el usuario. No utiliza backend, claves API ni servicios propios.

## Funciones incluidas

- Extracción de la transcripción desde la interfaz de YouTube.
- Pegado manual cuando el vídeo no ofrece transcripción o cambia la interfaz.
- Destinos: ChatGPT, Claude, Google AI Studio y Gemini.
- Resumen breve, medio o detallado.
- Formatos de resumen general, apuntes de estudio y capítulos.
- Conservación opcional de timestamps.
- Estimación aproximada del tamaño del prompt.
- Preferencias guardadas únicamente en el almacenamiento local de la extensión.

La extensión copia el prompt y abre el chat. El usuario conserva el control y
debe pegarlo y enviarlo manualmente.

## Probar en Firefox

1. Abre `about:debugging` en Firefox.
2. Selecciona **Este Firefox**.
3. Pulsa **Cargar complemento temporal**.
4. Selecciona el archivo `manifest.json` de este directorio.
5. Abre un vídeo de YouTube que tenga subtítulos.
6. Pulsa el icono de ResumeTube y después **Copiar y abrir chat**.
7. Pega el prompt en el chat con `Ctrl+V` y envíalo.

Los complementos temporales desaparecen al cerrar Firefox. Para desarrollo,
también se puede utilizar Mozilla `web-ext`:

```bash
npx web-ext run
```

## Estructura

```text
manifest.json
├── content/content-script.js  # Localiza y lee la transcripción
├── popup/popup.html           # Interfaz de la extensión
├── popup/popup.js             # Flujo principal y portapapeles
├── popup/prompt.js            # Plantillas y destinos de chat
└── icons/icon.svg
```

## Privacidad

ResumeTube no envía información a servidores propios. La transcripción solo se
copia al portapapeles. Cuando el usuario la pega y envía en un chat, queda
sujeta a las condiciones y política de privacidad del proveedor elegido.

El manifiesto declara explícitamente que la extensión no recopila ni transmite
datos, de acuerdo con el sistema de consentimiento incorporado en Firefox 140 y
versiones posteriores.

## Limitaciones conocidas

- La extracción depende de la interfaz de YouTube y puede requerir ajustes si
  YouTube modifica sus componentes internos.
- Algunos vídeos no tienen subtítulos o no permiten mostrar la transcripción.
- Los chats pueden imponer límites de tamaño diferentes. Para textos largos, la
  extensión muestra una advertencia a partir de unos 30.000 tokens estimados.
- La estimación de tokens es aproximada y depende del modelo elegido.
