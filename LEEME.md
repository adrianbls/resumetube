# ResumeTube

Extensión para Firefox que obtiene la transcripción visible de un vídeo de
YouTube, construye un prompt seguro para resumirla y abre el chat de IA elegido
por el usuario. No utiliza backend, claves API ni servicios propios.

## Funciones incluidas

- Extracción de la transcripción desde la interfaz de YouTube.
- Compatibilidad con el panel clásico y con `PAmodern_transcript_view`.
- Interfaz automática en español para cualquier locale `es-*` y en inglés para
  todos los demás idiomas.
- Selección del idioma del resumen entre unos 30 idiomas, o «el mismo idioma
  que la transcripción».
- Pegado manual cuando el vídeo no ofrece transcripción o cambia la interfaz.
- Destinos: ChatGPT, Claude, Google AI Studio y Gemini.
- Añadir chats propios (Perplexity, DeepSeek, etc.) indicando nombre y URL; se
  guardan y el último queda como predeterminado.
- Resumen breve, medio o detallado.
- Formatos de resumen general, apuntes de estudio y capítulos.
- Conservación opcional de timestamps.
- Prompt reforzado contra inyecciones: el contenido de la transcripción se trata
  solo como material a resumir y las instrucciones incluidas en él se ignoran.
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

Requiere Firefox 142 o posterior (`strict_min_version` en `manifest.json`).

## Pruebas

Las pruebas usan el ejecutor integrado de Node, sin dependencias externas:

```bash
node --test
```

Comprueban que los catálogos de mensajes en español e inglés comparten las
mismas claves y marcadores, y validan la lógica del content script.

## Estructura

```text
manifest.json
├── _locales/                  # Traducciones en español (es) e inglés (en)
├── content/content-script.js  # Localiza y lee la transcripción
├── popup/popup.html           # Interfaz de la extensión
├── popup/popup.js             # Flujo principal y portapapeles
├── popup/prompt.js            # Plantillas de prompt, idiomas y destinos de chat
├── popup/i18n.js              # Localización de la interfaz del popup
├── icons/icon.svg
└── tests/                     # Pruebas con node --test
```

## Privacidad

ResumeTube no envía información a servidores propios. La transcripción solo se
copia al portapapeles. Cuando el usuario la pega y envía en un chat, queda
sujeta a las condiciones y política de privacidad del proveedor elegido.

El manifiesto declara explícitamente que la extensión no recopila ni transmite
datos, de acuerdo con el sistema de consentimiento incorporado en Firefox 142 y
versiones posteriores.

## Limitaciones conocidas

- La extracción depende de la interfaz de YouTube y puede requerir ajustes si
  YouTube modifica sus componentes internos.
- Algunos vídeos no tienen subtítulos o no permiten mostrar la transcripción.
- Los chats pueden imponer límites de tamaño diferentes. Para textos largos, la
  extensión muestra una advertencia a partir de unos 30.000 tokens estimados.
- La estimación de tokens es aproximada y depende del modelo elegido.
</content>
</invoke>
