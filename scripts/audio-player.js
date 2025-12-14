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
 * Audio Player Class
 * Handles audio playback, playlist management, and UI updates
 */
class AudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.isShuffle = false;
        this.repeatMode = 'none'; // 'none', 'all', 'one'
        
        this.elements = {};
        
        // Bind methods
        this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
        this.handleEnded = this.handleEnded.bind(this);
        this.handlePlayPause = this.handlePlayPause.bind(this);
        this.handleNext = this.handleNext.bind(this);
        this.handlePrev = this.handlePrev.bind(this);
        this.handleSeek = this.handleSeek.bind(this);
        this.handleVolume = this.handleVolume.bind(this);
        this.toggleShuffle = this.toggleShuffle.bind(this);
        this.toggleRepeat = this.toggleRepeat.bind(this);
        this.close = this.close.bind(this);
    }

    /**
     * Initialize the player
     */
    init() {
        this.cacheElements();
        this.setupEventListeners();
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            container: document.getElementById('audio-player'),
            playlist: document.getElementById('audio-playlist-items'),
            
            // Track Info
            artPlaceholder: document.getElementById('album-art-placeholder'),
            title: document.getElementById('audio-track-title'),
            artist: document.getElementById('audio-track-artist'),
            
            // Controls
            playPauseBtn: document.getElementById('audio-play-pause'),
            prevBtn: document.getElementById('audio-prev'),
            nextBtn: document.getElementById('audio-next'),
            infoBtn: document.getElementById('audio-info'),
            shuffleBtn: document.getElementById('audio-shuffle'),
            repeatBtn: document.getElementById('audio-repeat'),
            volumeSlider: document.getElementById('audio-volume'),
            
            // Progress
            progressBar: document.getElementById('audio-progress-bar'),
            progressFill: document.getElementById('audio-progress-fill'),
            currentTime: document.getElementById('audio-current-time'),
            totalTime: document.getElementById('audio-total-time'),
            
            // Other
            backBtn: document.getElementById('audio-back-btn')
        };
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Audio Events
        this.audio.addEventListener('timeupdate', this.handleTimeUpdate);
        this.audio.addEventListener('ended', this.handleEnded);
        this.audio.addEventListener('loadedmetadata', () => {
            this.elements.totalTime.textContent = this.formatTime(this.audio.duration);
        });
        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            // Try next track if error occurs
            if (this.playlist.length > 1) this.handleNext();
        });

        // UI Controls
        this.elements.playPauseBtn.addEventListener('click', this.handlePlayPause);
        this.elements.prevBtn.addEventListener('click', this.handlePrev);
        this.elements.nextBtn.addEventListener('click', this.handleNext);
        if (this.elements.infoBtn) {
            this.elements.infoBtn.addEventListener('click', () => {
                if (this.playlist[this.currentIndex] && window.galleryUI) {
                    window.galleryUI.showFileModal(this.playlist[this.currentIndex]);
                }
            });
        }
        this.elements.shuffleBtn.addEventListener('click', this.toggleShuffle);
        this.elements.repeatBtn.addEventListener('click', this.toggleRepeat);
        this.elements.volumeSlider.addEventListener('input', this.handleVolume);
        // this.elements.backBtn.addEventListener('click', this.close);
        this.elements.backBtn.style.display = 'none';

        // Progress Bar
        this.elements.progressBar.addEventListener('click', this.handleSeek);
    }

    /**
     * Open player with files
     * @param {Array} files - List of file objects
     * @param {number} startIndex - Index to start playing
     */
    open(files, startIndex = 0) {
        // Filter for audio files only
        this.playlist = files.filter(f => f.type === 'audio');
        
        // Find the correct index in the filtered list
        const startFile = files[startIndex];
        this.currentIndex = this.playlist.findIndex(f => f.id === startFile.id);
        
        if (this.currentIndex === -1) this.currentIndex = 0;

        this.elements.container.classList.remove('hidden');
        this.renderPlaylist();
        this.loadTrack(this.currentIndex, true);
    }

    /**
     * Close player
     * @param {boolean} skipFileRemoval - If true, don't remove files (used when switching viewers)
     */
    close(skipFileRemoval = false) {
        this.audio.pause();
        this.elements.container.classList.add('hidden');
        this.isPlaying = false;
        this.updatePlayPauseIcon();

        // If we only have one file, return to home page (landing state)
        // BUT skip this if we're just switching viewers
        if (!skipFileRemoval && window.galleryUI && window.galleryUI.fileHandler) {
            if (window.galleryUI.fileHandler.files.length === 1) {
                const files = window.galleryUI.fileHandler.files;
                if (files.length > 0) {
                    window.galleryUI.fileHandler.removeFile(files[0].id);
                    window.galleryUI.renderFiles();
                }
            }
        }
    }

    /**
     * Load a track by index
     * @param {number} index 
     * @param {boolean} autoPlay 
     */
    loadTrack(index, autoPlay = false) {
        if (index < 0 || index >= this.playlist.length) return;

        this.currentIndex = index;
        const file = this.playlist[index];

        // Update Audio Source
        this.audio.src = file.url;
        this.audio.load();

        // Update UI
        this.elements.title.textContent = file.name;
        this.elements.artist.textContent = 'Artiste inconnu'; // Placeholder
        
        // Update Playlist Highlight
        this.updatePlaylistHighlight();

        // Reset Progress
        this.elements.progressFill.style.width = '0%';
        this.elements.currentTime.textContent = '0:00';
        this.elements.totalTime.textContent = '--:--';

        if (autoPlay) {
            this.play();
        }
    }

    /**
     * Play audio
     */
    play() {
        this.audio.play()
            .then(() => {
                this.isPlaying = true;
                this.updatePlayPauseIcon();
            })
            .catch(err => console.error('Playback failed:', err));
    }

    /**
     * Pause audio
     */
    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayPauseIcon();
    }

    /**
     * Toggle Play/Pause
     */
    handlePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Update Play/Pause Icon
     */
    updatePlayPauseIcon() {
        const icon = this.elements.playPauseBtn.querySelector('.material-icons');
        icon.textContent = this.isPlaying ? 'pause' : 'play_arrow';
    }

    /**
     * Handle Next Track
     */
    handleNext() {
        let nextIndex;
        
        if (this.isShuffle) {
            nextIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            nextIndex = this.currentIndex + 1;
            if (nextIndex >= this.playlist.length) {
                if (this.repeatMode === 'all') {
                    nextIndex = 0;
                } else {
                    return; // Stop at end
                }
            }
        }
        
        this.loadTrack(nextIndex, true);
    }

    /**
     * Handle Previous Track
     */
    handlePrev() {
        // If more than 3 seconds in, restart track
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }

        let prevIndex = this.currentIndex - 1;
        if (prevIndex < 0) {
            if (this.repeatMode === 'all') {
                prevIndex = this.playlist.length - 1;
            } else {
                prevIndex = 0;
            }
        }
        
        this.loadTrack(prevIndex, true);
    }

    /**
     * Handle Track End
     */
    handleEnded() {
        if (this.repeatMode === 'one') {
            this.audio.currentTime = 0;
            this.play();
        } else {
            this.handleNext();
        }
    }

    /**
     * Handle Time Update
     */
    handleTimeUpdate() {
        const current = this.audio.currentTime;
        const duration = this.audio.duration;
        
        if (isNaN(duration)) return;

        const percent = (current / duration) * 100;
        this.elements.progressFill.style.width = `${percent}%`;
        this.elements.currentTime.textContent = this.formatTime(current);
    }

    /**
     * Handle Seek
     * @param {Event} e 
     */
    handleSeek(e) {
        const rect = this.elements.progressBar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percent = x / width;
        
        if (this.audio.duration) {
            this.audio.currentTime = percent * this.audio.duration;
        }
    }

    /**
     * Handle Volume Change
     * @param {Event} e 
     */
    handleVolume(e) {
        this.audio.volume = e.target.value;
    }

    /**
     * Toggle Shuffle
     */
    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        this.elements.shuffleBtn.classList.toggle('active', this.isShuffle);
    }

    /**
     * Toggle Repeat
     */
    toggleRepeat() {
        if (this.repeatMode === 'none') {
            this.repeatMode = 'all';
            this.elements.repeatBtn.classList.add('active');
            this.elements.repeatBtn.querySelector('.material-icons').textContent = 'repeat';
        } else if (this.repeatMode === 'all') {
            this.repeatMode = 'one';
            this.elements.repeatBtn.classList.add('active');
            this.elements.repeatBtn.querySelector('.material-icons').textContent = 'repeat_one';
        } else {
            this.repeatMode = 'none';
            this.elements.repeatBtn.classList.remove('active');
            this.elements.repeatBtn.querySelector('.material-icons').textContent = 'repeat';
        }
    }

    /**
     * Render Playlist Sidebar
     */
    renderPlaylist() {
        this.elements.playlist.innerHTML = '';
        
        this.playlist.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            if (index === this.currentIndex) item.classList.add('active');
            
            item.innerHTML = `
                <span class="track-number">${index + 1}</span>
                <div class="track-info-list">
                    <span class="track-title-list">${file.name}</span>
                    <span class="track-artist-list">Artiste inconnu</span>
                </div>
                <span class="track-duration">--:--</span>
            `;
            
            item.addEventListener('click', () => {
                this.loadTrack(index, true);
            });
            
            this.elements.playlist.appendChild(item);
        });
    }

    /**
     * Update Playlist Highlight
     */
    updatePlaylistHighlight() {
        const items = this.elements.playlist.children;
        for (let i = 0; i < items.length; i++) {
            items[i].classList.toggle('active', i === this.currentIndex);
        }
    }

    /**
     * Format time in MM:SS
     * @param {number} seconds 
     * @returns {string}
     */
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}

// Initialize
window.audioPlayer = new AudioPlayer();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioPlayer;
}
