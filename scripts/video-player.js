/*
 * Copyright (C) 2025 Jema Technology
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Video Player Component
 * Handles video playback and UI controls
 */
class VideoPlayer {
    constructor(container, file, uiController) {
        this.container = container;
        this.file = file;
        this.uiController = uiController;
        this.video = null;
        this.isPlaying = false;
        this.duration = 0;
        this.currentTime = 0;
        this.volume = 1;
        this.isDragging = false;
        this.controlsTimeout = null;
        this.elements = {};
        
        this.init();
    }

    init() {
        this.container.innerHTML = '';
        this.container.className = 'video-player-container';
        
        console.log('[VideoPlayer] Initializing with file:', this.file.name, 'URL:', this.file.url, 'isLargeFile:', this.file.isLargeFile);
        
        // Create video element
        this.video = document.createElement('video');
        this.video.className = 'video-element';
        this.video.playsInline = true;
        
        // For large files, use the File object directly as source
        // This allows the browser to stream the file instead of loading it all into memory
        if (this.file.isLargeFile && this.file.file) {
            console.log('[VideoPlayer] Using File object directly for large file streaming');
            // Create a temporary blob URL just for this video element
            // The browser will stream from the file, not load it all into memory
            const tempUrl = URL.createObjectURL(this.file.file);
            this.video.src = tempUrl;
            this.tempBlobUrl = tempUrl; // Store for cleanup
        } else if (this.file.url) {
            this.video.src = this.file.url;
        } else if (this.file.file) {
            // Fallback: create blob URL from file
            const tempUrl = URL.createObjectURL(this.file.file);
            this.video.src = tempUrl;
            this.tempBlobUrl = tempUrl;
        }
        
        this.video.preload = 'metadata';
        
        // Create UI
        this.createUI();
        
        // Append video
        this.container.appendChild(this.video);
        this.container.appendChild(this.elements.controls);
        
        // Setup listeners
        this.setupEventListeners();
        
        // Auto play
        this.video.play().catch(e => console.warn('Auto-play prevented:', e));
    }

    createUI() {
        // Top Bar
        this.createTopBar();

        // Controls Container (Floating)
        this.elements.controls = document.createElement('div');
        this.elements.controls.className = 'video-controls';
        
        // Main Controls Row (Buttons)
        const controlsRow = document.createElement('div');
        controlsRow.className = 'video-controls-row main-controls';
        
        // Volume Container
        const volumeContainer = document.createElement('div');
        volumeContainer.className = 'volume-container';
        
        this.elements.volumeBtn = this.createButton('volume_up', 'Volume', () => this.toggleMute());
        this.elements.volumeSlider = document.createElement('input');
        this.elements.volumeSlider.type = 'range';
        this.elements.volumeSlider.className = 'volume-slider';
        this.elements.volumeSlider.min = 0;
        this.elements.volumeSlider.max = 1;
        this.elements.volumeSlider.step = 0.1;
        this.elements.volumeSlider.value = 1;
        
        volumeContainer.appendChild(this.elements.volumeBtn);
        volumeContainer.appendChild(this.elements.volumeSlider);
        
        // Center Controls
        const centerControls = document.createElement('div');
        centerControls.className = 'center-controls';
        
        this.elements.skipBackBtn = this.createButton('replay_10', 'Reculer de 10s', () => this.skip(-10));
        this.elements.playPauseBtn = this.createButton('play_arrow', 'Lecture', () => this.togglePlayPause());
        this.elements.skipFwdBtn = this.createButton('forward_10', 'Avancer de 10s', () => this.skip(10));
        
        centerControls.appendChild(this.elements.skipBackBtn);
        centerControls.appendChild(this.elements.playPauseBtn);
        centerControls.appendChild(this.elements.skipFwdBtn);
        
        // Right Controls
        const rightControls = document.createElement('div');
        rightControls.className = 'right-controls';
        
        this.elements.fullscreenBtn = this.createButton('fullscreen', 'Plein écran', () => this.toggleFullscreen());
        
        rightControls.appendChild(this.elements.fullscreenBtn);
        
        // Append to Controls Row
        controlsRow.appendChild(volumeContainer);
        controlsRow.appendChild(centerControls);
        controlsRow.appendChild(rightControls);
        
        // Progress Row
        const progressRow = document.createElement('div');
        progressRow.className = 'video-controls-row progress-row';
        
        this.elements.currentTime = document.createElement('span');
        this.elements.currentTime.className = 'time-display current';
        this.elements.currentTime.textContent = '0:00';
        
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-bar-container';
        
        this.elements.progressBar = document.createElement('div');
        this.elements.progressBar.className = 'progress-bar';
        
        this.elements.progressFill = document.createElement('div');
        this.elements.progressFill.className = 'progress-fill';
        
        this.elements.seekSlider = document.createElement('input');
        this.elements.seekSlider.type = 'range';
        this.elements.seekSlider.className = 'seek-slider';
        this.elements.seekSlider.min = 0;
        this.elements.seekSlider.max = 100;
        this.elements.seekSlider.value = 0;
        
        this.elements.progressBar.appendChild(this.elements.progressFill);
        progressContainer.appendChild(this.elements.progressBar);
        progressContainer.appendChild(this.elements.seekSlider);
        
        this.elements.duration = document.createElement('span');
        this.elements.duration.className = 'time-display duration';
        this.elements.duration.textContent = '0:00';
        
        progressRow.appendChild(this.elements.currentTime);
        progressRow.appendChild(progressContainer);
        progressRow.appendChild(this.elements.duration);
        
        // Append Rows to Controls
        this.elements.controls.appendChild(controlsRow);
        this.elements.controls.appendChild(progressRow);
    }

    createTopBar() {
        this.elements.topBar = document.createElement('div');
        this.elements.topBar.className = 'video-top-bar';
        
        // Left: Filename
        const leftSection = document.createElement('div');
        leftSection.className = 'top-bar-left';
        
        const title = document.createElement('span');
        title.className = 'video-title';
        title.textContent = this.file.name;
        
        leftSection.appendChild(title);
        
        // Right: Icons (Info, Share, Delete, Menu)
        const rightSection = document.createElement('div');
        rightSection.className = 'top-bar-right';
        
        const infoBtn = this.createButton('info', 'Infos', () => this.showInfo());
        infoBtn.classList.add('video-info-btn');
        
        rightSection.appendChild(infoBtn);
        
        this.elements.topBar.appendChild(leftSection);
        this.elements.topBar.appendChild(rightSection);
        
        this.container.appendChild(this.elements.topBar);
    }

    showInfo() {
        const ui = this.uiController || globalThis.galleryUI;
        if (ui) {
            ui.showFileModal(this.file);
        }
    }

    createButton(icon, title, onClick) {
        const btn = document.createElement('button');
        btn.className = 'video-btn';
        btn.title = title;
        btn.innerHTML = `<i class="material-icons">${icon}</i>`;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
        });
        return btn;
    }

    setupEventListeners() {
        // Video Events
        this.video.addEventListener('loadedmetadata', () => {
            this.duration = this.video.duration;
            this.elements.duration.textContent = this.formatTime(this.duration);
        });

        this.video.addEventListener('timeupdate', () => {
            this.currentTime = this.video.currentTime;
            this.updateProgress();
        });

        this.video.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayPauseButton();
        });

        this.video.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updatePlayPauseButton();
        });

        this.video.addEventListener('ended', () => {
            this.isPlaying = false;
            this.updatePlayPauseButton();
        });
        
        this.video.addEventListener('click', () => this.togglePlayPause());
        this.video.addEventListener('dblclick', () => this.toggleFullscreen());

        // Error handling
        this.video.addEventListener('error', (e) => {
            console.error('Video playback error:', this.video.error);
            
            let errorMessage;
            if (this.video.error) {
                switch (this.video.error.code) {
                    case 1: errorMessage = 'Lecture annulée'; break;
                    case 2: errorMessage = 'Erreur réseau'; break;
                    case 3: errorMessage = 'Erreur de décodage'; break;
                    case 4: errorMessage = 'Format non supporté'; break;
                    default: errorMessage = 'Erreur inconnue';
                }
            } else {
                errorMessage = 'Format non supporté';
            }

            const errorDisplay = document.createElement('div');
            errorDisplay.style.position = 'absolute';
            errorDisplay.style.top = '50%';
            errorDisplay.style.left = '50%';
            errorDisplay.style.transform = 'translate(-50%, -50%)';
            errorDisplay.style.color = '#ea4335';
            errorDisplay.style.background = 'rgba(0,0,0,0.8)';
            errorDisplay.style.padding = '16px';
            errorDisplay.style.borderRadius = '8px';
            errorDisplay.style.textAlign = 'center';
            errorDisplay.innerHTML = `
                <i class="material-icons" style="font-size: 48px; margin-bottom: 8px;">error_outline</i>
                <p>Erreur de lecture</p>
                <p style="font-size: 12px; color: #9aa0a6;">${errorMessage}</p>
            `;
            this.container.appendChild(errorDisplay);
        });

        // Fullscreen change events
        document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('mozfullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('MSFullscreenChange', () => this.updateFullscreenButton());

        // Volume Slider
        this.elements.volumeSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            this.setVolume(e.target.value);
        });
        
        this.elements.volumeSlider.addEventListener('click', (e) => e.stopPropagation());

        // Seek Slider
        this.elements.seekSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            this.isDragging = true;
            const seekTime = (e.target.value / 100) * this.duration;
            this.elements.currentTime.textContent = this.formatTime(seekTime);
            this.elements.progressFill.style.width = `${e.target.value}%`;
        });

        this.elements.seekSlider.addEventListener('change', (e) => {
            e.stopPropagation();
            this.isDragging = false;
            const seekTime = (e.target.value / 100) * this.duration;
            this.video.currentTime = seekTime;
        });
        
        this.elements.seekSlider.addEventListener('click', (e) => e.stopPropagation());

        // Controls Visibility
        this.container.addEventListener('mousemove', () => this.showControls());
        this.container.addEventListener('mouseleave', () => this.hideControls());
        
        // Initial show
        this.showControls();
    }

    play() {
        const playPromise = this.video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // Ignore AbortError which happens when pause() is called before play() finishes
                if (error.name !== 'AbortError') {
                    console.warn('Video playback prevented:', error);
                }
            });
        }
    }

    pause() {
        // Only pause if not already paused to avoid unnecessary events
        if (!this.video.paused) {
            this.video.pause();
        }
    }

    togglePlayPause() {
        if (this.video.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    updatePlayPauseButton() {
        const icon = this.isPlaying ? 'pause' : 'play_arrow';
        this.elements.playPauseBtn.innerHTML = `<i class="material-icons">${icon}</i>`;
    }

    updateFullscreenButton() {
        const isFullscreen = !!document.fullscreenElement;
        const icon = isFullscreen ? 'fullscreen_exit' : 'fullscreen';
        this.elements.fullscreenBtn.innerHTML = `<i class="material-icons">${icon}</i>`;
    }

    skip(seconds) {
        this.video.currentTime += seconds;
    }

    setVolume(value) {
        this.volume = value;
        this.video.volume = this.volume;
        this.elements.volumeSlider.value = this.volume;
        
        let icon = 'volume_up';
        if (this.volume === 0) icon = 'volume_off';
        else if (this.volume < 0.5) icon = 'volume_down';
        
        this.elements.volumeBtn.innerHTML = `<i class="material-icons">${icon}</i>`;
    }

    toggleMute() {
        if (this.video.volume > 0) {
            this.video.dataset.lastVolume = this.video.volume;
            this.setVolume(0);
        } else {
            this.setVolume(this.video.dataset.lastVolume || 1);
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.container.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    updateProgress() {
        if (this.isDragging) return;
        const percent = (this.currentTime / this.duration) * 100;
        this.elements.seekSlider.value = percent;
        this.elements.progressFill.style.width = `${percent}%`;
        this.elements.currentTime.textContent = this.formatTime(this.currentTime);
    }

    formatTime(seconds) {
        if (!seconds || Number.isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    showControls() {
        this.elements.controls.classList.add('visible');
        if (this.elements.topBar) this.elements.topBar.classList.add('visible');
        this.container.style.cursor = 'default';
        
        clearTimeout(this.controlsTimeout);
        this.controlsTimeout = setTimeout(() => {
            if (this.isPlaying) {
                this.hideControls();
            }
        }, 3000);
    }

    hideControls() {
        if (this.isPlaying) {
            this.elements.controls.classList.remove('visible');
            if (this.elements.topBar) this.elements.topBar.classList.remove('visible');
            this.container.style.cursor = 'none';
        }
    }
    
    destroy() {
        if (this.video) {
            this.video.pause();
            this.video.src = '';
            this.video.load();
        }
        // Clean up temporary blob URL if we created one
        if (this.tempBlobUrl) {
            URL.revokeObjectURL(this.tempBlobUrl);
            this.tempBlobUrl = null;
        }
        this.container.innerHTML = '';
    }
}

globalThis.VideoPlayer = VideoPlayer;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VideoPlayer;
}
