# JemaOS Gallery

**JemaOS Gallery** is a versatile and lightweight media gallery application designed for JemaOS. It provides a seamless experience for viewing images, playing videos, listening to audio files, and reading PDFs, all within a modern web interface.

## Features

- **Image Viewer**: Support for a wide range of image formats with smooth navigation.
- **Video Player**: Integrated video player for playback of common video formats.
- **Audio Player**: Listen to your favorite audio tracks directly in the gallery.
- **PDF Viewer**: Built-in PDF viewer for easy document reading.
- **Annotation Tools**: Add and manage annotations on your media files.
- **Progressive Web App (PWA)**: Installable on supported devices for an app-like experience.
- **File Handling**: robust file handling capabilities including drag-and-drop support.

## Installation & Usage

This project is a static web application that can be served using any static file server. It includes scripts for easy development and serving.

### Prerequisites

- [Node.js](https://nodejs.org/) (version 14 or higher recommended)

### Getting Started

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/JemaTechnology/jemaos-gallery.git
    cd jemaos-gallery
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This will start a live-reload server, typically accessible at `http://127.0.0.1:8080`.

4.  **Run in production mode:**
    ```bash
    npm start
    ```

5.  **Generate icons (including file type icons):**
    ```bash
    npm run generate-icons
    ```

## Windows MSIX Packaging

For custom file type icons in Windows Explorer, Galerie can be packaged as an MSIX application. This allows files associated with Galerie to display branded icons.

### Why MSIX?

PWAs cannot control how Windows Explorer displays file icons. The `file_handlers` in the web manifest only affects the "Open With" dialog. MSIX packaging enables:

- Custom icons for associated file types (images, videos, audio, PDFs)
- Galerie branding visible in Windows Explorer
- Microsoft Store distribution

### Quick Start

1. Generate icons: `npm run generate-icons`
2. Use [PWABuilder](https://pwabuilder.com) to create the MSIX package
3. Upload the configuration from `msix/pwabuilder.json`

See [`msix/README.md`](msix/README.md) for detailed packaging instructions.

## Technologies Used

- **HTML5**
- **CSS3**
- **JavaScript (Vanilla)**
- **Service Workers** (for PWA functionality)

## License

This project is open source and available under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE](LICENSE) file for more details.

## Credits

Developed by **Jema Technology**.
