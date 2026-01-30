const AppState = {
	webStream: null,
	webCameraActive: false,
	capturedPhotos: []
};

const Elements = {
	captureButton: null,
	takePhotoButton: null,
	galleryButton: null,
	galleryDropdown: null,
	video: null,
	image: null,
	flashOverlay: null
};

const Config = {
	VIDEO_CONSTRAINTS: {
		video: {
			facingMode: 'environment',
			width: { ideal: 1280 },
			height: { ideal: 720 }
		},
		audio: false
	},
	VIDEO_CONSTRAINTS_FALLBACK: {
		video: true,
		audio: false
	},
	FLASH_DURATION: 150,
	CAMERA_TRANSITION_DELAY: 150,
	CLOSE_TRANSITION_DURATION: 400,
	ANIMATION_DELAY: 10,
	GALLERY_CLOSE_DELAY: 300
};

// ============== DEBUG ==============
function logDebug(message) {
	console.log('[Caamery] ' + message);
	// Debug info deshabilitado en la UI
}


function initializeApp() {
	logDebug('App inicializada');
	logDebug('Cordova disponible: ' + isCordovaAvailable());
	logDebug('getUserMedia disponible: ' + (navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia));
	logDebug('Plataforma: ' + (window.cordova ? window.cordova.platformId : 'Web'));
	
	cacheElements();
	setupEventListeners();
	initializeCaptureButton();
	
	// Solicitar permisos de cámara al inicio en Android
	if (isCordovaAvailable()) {
		requestCameraPermissionsOnStartup();
	}
}

function requestCameraPermissionsOnStartup() {
	if (!window.AndroidPermission) {
		logDebug('Plugin de permisos no disponible');
		return;
	}
	
	logDebug('Solicitando permisos de cámara al inicio...');
	
	// Solicitar múltiples permisos a la vez
	const permissions = [
		window.AndroidPermission.PERMISSION.CAMERA,
		window.AndroidPermission.PERMISSION.WRITE_EXTERNAL_STORAGE,
		window.AndroidPermission.PERMISSION.READ_EXTERNAL_STORAGE
	];
	
	window.AndroidPermission.requestPermissions(permissions,
		() => {
			logDebug('✓ Todos los permisos concedidos');
		},
		(deniedPermissions) => {
			logDebug('⚠ Algunos permisos denegados: ' + JSON.stringify(deniedPermissions));
		}
	);
}

function cacheElements() {
	Elements.captureButton = document.getElementById('btn-capture');
	Elements.takePhotoButton = document.getElementById('btn-take-photo');
	Elements.galleryButton = document.getElementById('btn-gallery');
	Elements.galleryDropdown = document.getElementById('gallery-dropdown');
	Elements.video = document.getElementById('video');
	Elements.image = document.getElementById('image');
	Elements.flashOverlay = document.getElementById('flash-overlay');
}

function setupEventListeners() {
	if (!Elements.captureButton) return;

	Elements.captureButton.addEventListener('click', handleCaptureButtonClick);

	if (Elements.takePhotoButton) {
		Elements.takePhotoButton.addEventListener('click', capturePhoto);
	}

	if (Elements.galleryButton) {
		Elements.galleryButton.addEventListener('click', toggleGallery);
	}

	const btnCloseGallery = document.getElementById('btn-close-gallery');
	if (btnCloseGallery) {
		btnCloseGallery.addEventListener('click', closeGallery);
	}

	// Ajustar preview cuando el video esté listo
	if (Elements.video) {
		Elements.video.addEventListener('loadedmetadata', adjustPreviewToVideoResolution);
	}
}

function initializeCaptureButton() {
	updateCaptureButtonState(false);
}



function adjustPreviewToVideoResolution() {
	if (!Elements.video || !Elements.video.videoWidth || !Elements.video.videoHeight) return;

	const preview = document.querySelector('.preview');
	if (!preview) return;

	const aspectRatio = Elements.video.videoWidth / Elements.video.videoHeight;
	preview.style.aspectRatio = aspectRatio;
}



function handleCaptureButtonClick() {
	if (isCordovaAvailable()) {
		handleCordovaCamera();
	} else {
		handleWebCamera();
	}
}

function isCordovaAvailable() {
	return window.cordova && window.cordova.platformId !== 'browser';
}

function handleCordovaCamera() {
	// En Cordova también usamos getUserMedia para vista en tiempo real
	handleWebCamera();
}

function handleWebCamera() {
	if (AppState.webCameraActive) {
		stopWebCamera();
	} else {
		startWebCamera();
	}
}

if (window.cordova) {
	document.addEventListener('deviceready', initializeApp);
} else {
	document.addEventListener('DOMContentLoaded', initializeApp);
}


// ============== CÁMARA WEB ==============
function startWebCamera() {
	if (!validateCameraSupport()) return;
	if (AppState.webCameraActive) return;

	clearPreviousImage();
	
	logDebug('Iniciando cámara...');
	requestCameraStream();
}

function validateCameraSupport() {
	if (!Elements.video) {
		alert('No se encontró el elemento de video.');
		return false;
	}

	if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
		alert('Tu navegador no soporta getUserMedia.');
		return false;
	}

	return true;
}

function clearPreviousImage() {
	if (Elements.image) {
		Elements.image.classList.remove('is-active');
		Elements.image.src = '';
	}
}

function requestCameraStream() {
	logDebug('Solicitando acceso a cámara...');
	navigator.mediaDevices
		.getUserMedia(Config.VIDEO_CONSTRAINTS)
		.then(handleStreamSuccess)
		.catch((err) => {
			logDebug('Primer intento con restricciones fallido: ' + err.name);
			console.warn('Primer intento con restricciones fallido, intentando con restricciones flexibles...', err);
			// Intentar con restricciones más flexibles
			navigator.mediaDevices
				.getUserMedia(Config.VIDEO_CONSTRAINTS_FALLBACK)
				.then(handleStreamSuccess)
				.catch(handleStreamError);
		});
}

function handleStreamSuccess(stream) {
	AppState.webStream = stream;
	AppState.webCameraActive = true;

	updateCaptureButtonState(true);
	updateActionButtonsVisibility(true);

	Elements.video.srcObject = stream;
	Elements.video.play();

	setTimeout(() => {
		Elements.video.classList.add('is-active');
	}, Config.CAMERA_TRANSITION_DELAY);
}

function handleStreamError(err) {
	console.error('Error al acceder a la cámara:', err);
	
	let errorMessage = 'No se pudo acceder a la cámara';
	
	if (err.name === 'NotAllowedError') {
		errorMessage = 'Permiso de cámara denegado.';
	} else if (err.name === 'NotFoundError') {
		errorMessage = 'No se encontró ninguna cámara en el dispositivo.';
	} else if (err.name === 'NotReadableError') {
		errorMessage = 'No se puede acceder a la cámara. ¿Está siendo usada por otra aplicación?';
	} else if (err.name === 'OverconstrainedError') {
		errorMessage = 'Las restricciones de video no son soportadas por tu cámara.';
	} else if (err.message) {
		errorMessage = errorMessage + ': ' + err.message;
	}
	
	alert(errorMessage);
}

function stopWebCamera() {
	// Iniciar transición de opacidad
	if (Elements.video) {
		Elements.video.classList.remove('is-active');
	}
	if (Elements.image) {
		Elements.image.classList.remove('is-active');
	}

	// Esperar a que termine la transición antes de limpiar
	setTimeout(() => {
		cleanupStreamTracks();
		AppState.webCameraActive = false;
		updateCaptureButtonState(false);
		updateActionButtonsVisibility(false);
	}, Config.CLOSE_TRANSITION_DURATION);
}

function cleanupStreamTracks() {
	if (AppState.webStream) {
		AppState.webStream.getTracks().forEach((track) => track.stop());
		AppState.webStream = null;
	}

	if (Elements.video) {
		Elements.video.pause();
		Elements.video.srcObject = null;
	}

	if (Elements.image) {
		Elements.image.src = '';
	}
}

// ============== CAPTURA DE FOTOS ==============
function capturePhoto() {
	if (!Elements.video || !AppState.webCameraActive) return;

	triggerFlashEffect();
	capturePhotoFromVideo();
}

function triggerFlashEffect() {
	if (!Elements.flashOverlay) return;

	Elements.flashOverlay.classList.add('flash');
	setTimeout(() => {
		Elements.flashOverlay.classList.remove('flash');
	}, Config.FLASH_DURATION);
}

function capturePhotoFromVideo() {
	const canvas = document.createElement('canvas');
	canvas.width = Elements.video.videoWidth;
	canvas.height = Elements.video.videoHeight;
	const ctx = canvas.getContext('2d');

	if (!ctx) return;

	// Voltear horizontalmente para corregir el espejo
	ctx.scale(-1, 1);
	ctx.drawImage(Elements.video, -canvas.width, 0, canvas.width, canvas.height);
	ctx.setTransform(1, 0, 0, 1, 0, 0);

	const dataURL = canvas.toDataURL('image/png');
	savePhotoToGallery(dataURL);
	downloadPhotoBlob(dataURL);
}

function savePhotoToGallery(dataURL) {
	const photoData = {
		id: Date.now(),
		url: dataURL,
		timestamp: new Date()
	};
	AppState.capturedPhotos.push(photoData);
	updateGalleryButtonVisibility(true);
	updateGalleryView();
}

function downloadPhotoBlob(dataURL) {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	const img = new Image();
	
	img.onload = function() {
		canvas.width = img.width;
		canvas.height = img.height;
		ctx.drawImage(img, 0, 0);
		
		canvas.toBlob((blob) => {
			if (blob) {
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `caamery-${Date.now()}.png`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}
		}, 'image/png');
	};
	
	img.src = dataURL;
}

// ============== GALERÍA ==============
function toggleGallery() {
	if (!Elements.galleryDropdown) return;

	if (Elements.galleryDropdown.style.display === 'none') {
		openGallery();
	} else {
		closeGallery();
	}
}

function openGallery() {
	Elements.galleryDropdown.style.display = 'block';
	setTimeout(() => {
		Elements.galleryDropdown.classList.add('show');
	}, Config.ANIMATION_DELAY);
}

function closeGallery() {
	if (!Elements.galleryDropdown) return;

	Elements.galleryDropdown.classList.remove('show');
	setTimeout(() => {
		Elements.galleryDropdown.style.display = 'none';
	}, Config.GALLERY_CLOSE_DELAY);

	// Ocultar botón de galería si no hay fotos
	if (AppState.capturedPhotos.length === 0) {
		updateGalleryButtonVisibility(false);
	}
}

function updateGalleryView() {
	const galleryGrid = document.getElementById('gallery-grid');
	if (!galleryGrid) return;

	if (AppState.capturedPhotos.length === 0) {
		galleryGrid.innerHTML = '<div class="gallery-empty">No hay fotos capturadas</div>';
		return;
	}

	galleryGrid.innerHTML = '';
	AppState.capturedPhotos.forEach((photo) => {
		const item = createGalleryItem(photo);
		galleryGrid.appendChild(item);
	});
}

function createGalleryItem(photo) {
	const item = document.createElement('div');
	item.className = 'gallery-item';

	const img = document.createElement('img');
	img.src = photo.url;
	img.alt = 'Foto capturada';

	item.addEventListener('click', () => downloadPhotoFromGallery(photo));
	item.appendChild(img);

	return item;
}

function downloadPhotoFromGallery(photo) {
	const a = document.createElement('a');
	a.href = photo.url;
	a.download = `caamery-${photo.id}.png`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

// ============== ACTUALIZACIONES DE UI ==============
function updateCaptureButtonState(isActive) {
	if (!Elements.captureButton) return;

	Elements.captureButton.textContent = isActive ? 'Desactivar cámara' : 'Activar cámara';
	Elements.captureButton.classList.toggle('is-danger', isActive);
}

function updateActionButtonsVisibility(show) {
	updatePhotoButtonVisibility(show);
	// La galería se controla independently basada en fotos capturadas
}

function updatePhotoButtonVisibility(show) {
	if (!Elements.takePhotoButton) return;

	if (show) {
		Elements.takePhotoButton.style.display = 'block';
		setTimeout(() => {
			Elements.takePhotoButton.classList.add('show');
		}, Config.ANIMATION_DELAY);
	} else {
		Elements.takePhotoButton.classList.remove('show');
		setTimeout(() => {
			Elements.takePhotoButton.style.display = 'none';
		}, Config.GALLERY_CLOSE_DELAY);
	}
}

function updateGalleryButtonVisibility(show) {
	if (!Elements.galleryButton) return;

	if (show) {
		Elements.galleryButton.style.display = 'flex';
		setTimeout(() => {
			Elements.galleryButton.classList.add('show');
		}, Config.ANIMATION_DELAY);
	} else {
		Elements.galleryButton.classList.remove('show');
		setTimeout(() => {
			Elements.galleryButton.style.display = 'none';
		}, Config.GALLERY_CLOSE_DELAY);
	}
}
