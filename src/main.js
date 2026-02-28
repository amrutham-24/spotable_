import { createClient } from '@supabase/supabase-js';

// ── Configuration ──
const SUPABASE_URL = 'https://drfwzycmxvkprkrjsxka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyZnd6eWNteHZrcHJrcmpzeGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTgxNjEsImV4cCI6MjA4Nzc5NDE2MX0.Ul6d1zS0yiRUz0T1SrAVAIBNJGCQ3jkDdxTuhB1rLvw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── State ──
let map;
let userLocation = null;
let currentMarkers = [];
let allWorkers = [];
let filteredWorkers = [];
let activeView = 'map-view';
let currentFilter = 'all';
let sortBy = 'nearest';
let searchQuery = '';
let currentChatWorker = null;
let messageSubscription = null;
let savedWorkerIds = new Set();

// ── DOM Elements ──
const bottomSheet = document.getElementById('bottom-sheet');
const sheetContent = document.getElementById('sheet-content');
const categoryChips = document.querySelectorAll('.chip');
const mapSearchInput = document.getElementById('search-input');
const discoverySearchInput = document.getElementById('discovery-search');
const sheetHandle = document.querySelector('.sheet-handle');
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-btn');
const discoveryWorkerList = document.getElementById('discovery-worker-list');
const discoveryCategories = document.getElementById('discovery-categories');
const sortNearest = document.getElementById('sort-nearest');
const sortTopRated = document.getElementById('sort-toprated');

// Navigation & Sidebars
const profileToggle = document.getElementById('profile-toggle');
const navProfileToggle = document.getElementById('nav-profile-toggle');
const rightPane = document.getElementById('right-pane');
const closePane = document.getElementById('close-pane');
const openAddWorker = document.getElementById('open-add-worker');
const addWorkerModal = document.getElementById('add-worker-modal');
const closeAddWorker = document.getElementById('close-add-worker');
const addWorkerForm = document.getElementById('add-worker-form');
const fetchLocationBtn = document.getElementById('fetch-location-btn');
const currentLocationText = document.getElementById('current-location-text');
const workerCoordsInput = document.getElementById('worker-coords');

// Chat DOM
const chatView = document.getElementById('chat-view');
const closeChat = document.getElementById('close-chat');
const chatWithName = document.getElementById('chat-with-name');
const messagesContainer = document.getElementById('messages-container');
const chatInput = document.getElementById('chat-input');
const sendMsgBtn = document.getElementById('send-msg-btn');

// ── Initialization ──
async function init() {
    const defaultLat = 10.0471;
    const defaultLng = 76.3354;

    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([defaultLat, defaultLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    setupEventListeners();
    renderCategories();
    await detectUserLocation();

    // Auto-refresh workers occasionally
    setInterval(fetchWorkers, 10000);
}

async function detectUserLocation() {
    if ("geolocation" in navigator) {
        currentLocationText.textContent = "Detecting...";
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                userLocation = [lat, lon];
                map.setView(userLocation, 14);

                // Reverse Geocoding
                try {
                    const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                    const data = await resp.json();
                    const address = data.display_name.split(',')[0] + ', ' + (data.address.city || data.address.suburb || data.address.town || '');
                    currentLocationText.textContent = address;
                } catch (e) {
                    currentLocationText.textContent = `Lat: ${lat.toFixed(4)}, Lng: ${lon.toFixed(4)}`;
                }

                if (workerCoordsInput) workerCoordsInput.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

                renderUserMarker();
                await fetchWorkers();
                await fetchSavedWorkerIds();
                resolve();
            }, () => {
                userLocation = [10.0471, 76.3354];
                renderUserMarker();
                fetchWorkers();
                resolve();
            });
        });
    }
}

function renderUserMarker() {
    if (!userLocation) return;
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: '<div class="user-dot"></div>',
        iconSize: [22, 22]
    });
    L.marker(userLocation, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
}

// ── Data Fetching ──
async function fetchWorkers() {
    try {
        const { data, error } = await supabase.from('workers').select('*');
        if (error) throw error;
        allWorkers = data;
        applyFiltersAndSort();
    } catch (err) {
        console.error("Error fetching workers:", err);
    }
}

function applyFiltersAndSort() {
    filteredWorkers = allWorkers.filter(worker => {
        const matchesCat = currentFilter === 'all' || worker.category === currentFilter;
        const nameMatch = worker.name.toLowerCase().includes(searchQuery);
        const catMatch = worker.category.toLowerCase().includes(searchQuery);
        return matchesCat && (nameMatch || catMatch);
    });

    if (userLocation) {
        filteredWorkers = filteredWorkers.map(worker => {
            const dist = calculateDistance(userLocation[0], userLocation[1], worker.latitude, worker.longitude);
            return { ...worker, distance: parseFloat(dist) };
        });
    }

    if (sortBy === 'nearest') {
        filteredWorkers.sort((a, b) => a.distance - b.distance);
    } else {
        filteredWorkers.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    renderMapMarkers();
    renderDiscoveryList();
}

// ── Rendering ──
function renderMapMarkers() {
    currentMarkers.forEach(m => map.removeLayer(m));
    currentMarkers = [];

    filteredWorkers.forEach(worker => {
        const icon = L.divIcon({
            className: 'worker-marker',
            html: `
                <div class="marker-inner" style="border-color: ${worker.color_code || '#1877F2'};">
                    ${getCategoryIcon(worker.category)}
                </div>
            `,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });

        const marker = L.marker([worker.latitude, worker.longitude], { icon }).addTo(map);
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            openWorkerDetails(worker);
        });
        currentMarkers.push(marker);
    });
}

function renderDiscoveryList() {
    if (!discoveryWorkerList) return;
    discoveryWorkerList.innerHTML = filteredWorkers.map(worker => `
        <div class="disc-worker-card" onclick="handleDiscoveryCardClick(${JSON.stringify(worker).replace(/"/g, '&quot;')})">
            <div class="disc-img-container">
                <img src="${worker.image_url}" class="disc-worker-img" alt="${worker.name}" />
                <div class="status-indicator ${getStatusClass(worker.status)}"></div>
            </div>
            <div class="disc-worker-info">
                <div class="disc-row-top">
                    <span class="disc-worker-name">${worker.name}</span>
                    <span class="rating-badge">★ ${worker.rating ? worker.rating.toFixed(1) : '4.5'}</span>
                </div>
                <p class="disc-cat">${worker.category}</p>
                <div class="disc-footer">
                    <span class="disc-dist">📍 ${worker.distance || '...'} km away</span>
                    <span class="status-tag ${getStatusClass(worker.status)}">${getStatusText(worker.status, worker.next_available_at)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function renderCategories() {
    const cats = [
        { name: 'Electrician', icon: '⚡' }, { name: 'Plumber', icon: '🔧' },
        { name: 'Gardener', icon: '🌱' }, { name: 'Cook', icon: '🍳' },
        { name: 'Pet Sitter', icon: '🐾' }, { name: 'Babysitter', icon: '👶' },
        { name: 'Street Food', icon: '🍱' }, { name: 'Cobbler', icon: '👞' }
    ];

    if (discoveryCategories) {
        discoveryCategories.innerHTML = cats.map(cat => `
            <div class="cat-item" onclick="filterByCategory('${cat.name}')">
                <div class="cat-icon">${cat.icon}</div>
                <span class="cat-label">${cat.name}</span>
            </div>
        `).join('');
    }
}

// ── Event Listeners ──
function setupEventListeners() {
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.getAttribute('data-view');
            if (activeView === targetView) return;
            switchView(targetView);
        });
    });

    categoryChips.forEach(chip => {
        chip.addEventListener('click', () => {
            categoryChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-category');
            applyFiltersAndSort();
        });
    });

    sortNearest.addEventListener('click', () => {
        sortNearest.classList.add('active');
        sortTopRated.classList.remove('active');
        sortBy = 'nearest';
        applyFiltersAndSort();
    });

    sortTopRated.addEventListener('click', () => {
        sortTopRated.classList.add('active');
        sortNearest.classList.remove('active');
        sortBy = 'rating';
        applyFiltersAndSort();
    });

    [mapSearchInput, discoverySearchInput].forEach(inp => {
        if (!inp) return;
        inp.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            applyFiltersAndSort();
        });
    });

    profileToggle.addEventListener('click', () => rightPane.classList.add('open'));
    navProfileToggle.addEventListener('click', () => rightPane.classList.add('open'));
    closePane.addEventListener('click', () => rightPane.classList.remove('open'));
    openAddWorker.addEventListener('click', () => {
        addWorkerModal.classList.add('open');
        resetAddWorkerForm();
    });
    closeAddWorker.addEventListener('click', () => addWorkerModal.classList.remove('open'));
    fetchLocationBtn.addEventListener('click', detectUserLocation);
    addWorkerForm.addEventListener('submit', handleAddWorker);

    const retryCaptureBtn = document.getElementById('auto-capture-btn');
    if (retryCaptureBtn) {
        retryCaptureBtn.addEventListener('click', detectUserLocation);
    }

    // Image Preview Logic
    const imageInput = document.getElementById('worker-image');
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const previewContainer = document.getElementById('image-preview');
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    previewContainer.style.backgroundImage = `url(${e.target.result})`;
                    previewContainer.style.backgroundSize = 'cover';
                    previewContainer.style.backgroundPosition = 'center';
                    previewContainer.querySelector('span').style.display = 'none';
                }
                reader.readAsDataURL(file);
            }
        });
    }

    map.on('click', closeBottomSheet);
    sheetHandle.addEventListener('click', () => {
        if (bottomSheet.classList.contains('full')) {
            bottomSheet.classList.remove('full');
            bottomSheet.classList.add('peek');
        } else {
            bottomSheet.classList.add('full');
        }
    });

    // Chat Listeners
    closeChat.addEventListener('click', () => switchView('map-view'));
    sendMsgBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
}

function switchView(target) {
    views.forEach(v => v.classList.remove('active'));
    const targetEl = document.getElementById(target);
    if (targetEl) targetEl.classList.add('active');
    activeView = target;

    navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === target);
    });

    if (target === 'map-view') {
        setTimeout(() => map.invalidateSize(), 100);
    } else if (target === 'saved-view') {
        renderSavedWorkers();
    } else if (target === 'requests-view') {
        renderRequests();
    }
}

function closeRightPane() {
    rightPane.classList.remove('open');
}

window.switchView = switchView;
window.closeRightPane = closeRightPane;

// ── Helpers ──
window.filterByCategory = (cat) => {
    currentFilter = cat;
    categoryChips.forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-category') === cat);
    });
    applyFiltersAndSort();
    switchView('map-view');
};

window.handleDiscoveryCardClick = (worker) => {
    if (activeView === 'map-view' && bottomSheet.classList.contains('peek') && currentDetailsWorkerId === worker.id) {
        closeBottomSheet();
    } else {
        switchView('map-view');
        setTimeout(() => {
            map.invalidateSize();
            openWorkerDetails(worker);
        }, 100);
    }
};

let currentDetailsWorkerId = null;

async function openWorkerDetails(worker) {
    currentDetailsWorkerId = worker.id;
    const isSaved = savedWorkerIds.has(worker.id);
    const origin = userLocation ? `${userLocation[0]},${userLocation[1]}` : '';
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${worker.latitude},${worker.longitude}`;

    // Reverse Geocode Worker Location
    let workerAddress = `Lat: ${worker.latitude.toFixed(4)}, Lng: ${worker.longitude.toFixed(4)}`;
    try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${worker.latitude}&lon=${worker.longitude}`);
        const data = await resp.json();
        workerAddress = data.display_name.split(',')[0] + ', ' + (data.address.city || data.address.suburb || data.address.town || '');
    } catch (e) {
        console.error("Worker geocode error:", e);
    }

    const starsHtml = [1, 2, 3, 4, 5].map(i => `
        <span class="star ${i <= Math.round(worker.rating || 0) ? 'filled' : ''}" onclick="window.rateWorker('${worker.id}', ${i})">★</span>
    `).join('');

    sheetContent.innerHTML = `
        <div class="worker-card">
            <div class="worker-header">
                <img src="${worker.image_url}" class="worker-img" />
                <div class="worker-info" style="flex:1">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start">
                        <h2 class="worker-name" style="margin:0">${worker.name}</h2>
                        <button class="save-btn" onclick="window.toggleSaveWorker('${worker.id}')" style="background:none; border:none; font-size:24px; cursor:pointer; color:${isSaved ? '#1877F2' : '#606770'}">
                            ${isSaved ? '🔖' : '📑'}
                        </button>
                    </div>
                    <span class="worker-category" style="background: ${worker.color_code}1A; color: ${worker.color_code};">${worker.category}</span>
                    <div class="worker-stats">
                        <span class="rating">★ ${worker.rating ? worker.rating.toFixed(1) + '/5.0' : '4.5/5.0'}</span>
                        <span class="distance">📍 ${worker.distance || '...'} km</span>
                    </div>
                </div>
            </div>
            
            <div class="location-section" style="margin: 10px 0; font-size: 14px; color: var(--fb-text-secondary); display:flex; align-items:center; gap:5px">
                <span>📍</span> <strong>Location:</strong> ${workerAddress}
            </div>

            <div class="contact-section" style="margin: 10px 0; font-size: 14px; color: var(--fb-text-secondary); display:flex; align-items:center; gap:5px">
                <span>📞</span> <strong>Phone:</strong> ${worker.phone || 'N/A'}
            </div>

            <div class="rating-section" style="margin: 15px 0">
                <p style="font-size: 13px; font-weight: 600; color: var(--fb-text-secondary); margin-bottom: 5px">Rate this worker:</p>
                <div class="star-rating" style="display:flex; gap:5px">${starsHtml}</div>
            </div>

            <div class="worker-tags" style="margin: 15px 0">
                <span class="tag ${getStatusClass(worker.status)}">${getStatusText(worker.status, worker.next_available_at)}</span>
            </div>

            <div class="worker-actions" style="display:flex; gap:10px">
                <a href="tel:${worker.phone}" class="btn btn-secondary" style="flex:1; background:#E7F3FF; color:#1877F2; border:none; padding:12px; border-radius:10px; font-weight:700; text-decoration:none; text-align:center">Contact</a>
                <button class="btn btn-primary" style="flex:1; background:var(--fb-blue); color:white; border:none; padding:12px; border-radius:10px; font-weight:700" onclick="window.open('${gmapsUrl}', '_blank')">Directions</button>
            </div>
            <div style="margin-top:10px">
                <button class="btn btn-secondary" style="width:100%; background:var(--fb-bg); border:none; padding:12px; border-radius:10px; font-weight:700" onclick="window.startChat(${JSON.stringify(worker).replace(/"/g, '&quot;')})">Chat</button>
            </div>
            <button class="close-sheet-btn" onclick="window.closeBottomSheet()" style="position:absolute; top:10px; right:10px; background:white; border:none; font-size:20px; cursor:pointer; width:30px; height:30px; border-radius:50%; box-shadow:0 2px 5px rgba(0,0,0,0.2)">×</button>
        </div>
    `;

    bottomSheet.classList.add('peek');
    map.panTo([worker.latitude, worker.longitude]);
}

// ── Rating Logic ──
window.rateWorker = async (workerId, rating) => {
    try {
        const { error: reviewError } = await supabase.from('reviews').insert({ worker_id: workerId, rating });
        if (reviewError) throw reviewError;

        // Fetch all ratings for this worker to update avg
        const { data: reviews, error: fetchError } = await supabase.from('reviews').select('rating').eq('worker_id', workerId);
        if (fetchError) throw fetchError;

        const avg = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;

        const { error: updateError } = await supabase.from('workers').update({ rating: avg }).eq('id', workerId);
        if (updateError) throw updateError;

        alert("Thanks for your rating!");
        await fetchWorkers();
        // Refresh local view
        const worker = allWorkers.find(w => w.id === workerId);
        if (worker) openWorkerDetails(worker);
    } catch (err) {
        console.error("Rating error:", err);
    }
};

// ── Chat Logic ──
window.startChat = (worker) => {
    currentChatWorker = worker;
    chatWithName.textContent = `Chat with ${worker.name}`;
    switchView('chat-view');
    loadMessages();
    subscribeToMessages();
};

async function loadMessages() {
    if (!currentChatWorker) return;
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.user,receiver_id.eq.${currentChatWorker.id}),and(sender_id.eq.${currentChatWorker.id},receiver_id.eq.user)`)
        .order('created_at', { ascending: true });

    if (error) console.error("Error loading msg:", error);
    else renderMessages(data);
}

function renderMessages(msgs) {
    messagesContainer.innerHTML = msgs.map(m => `
        <div class="message ${m.sender_id === 'user' ? 'sent' : 'received'}">
            ${m.content}
        </div>
    `).join('');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || !currentChatWorker) return;

    chatInput.value = '';
    const { error } = await supabase.from('messages').insert({
        sender_id: 'user',
        receiver_id: currentChatWorker.id,
        content: text
    });

    if (error) alert("Failed to send message");
}

function subscribeToMessages() {
    if (messageSubscription) supabase.removeChannel(messageSubscription);

    messageSubscription = supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const newMsg = payload.new;
            if (newMsg.sender_id === 'user' || newMsg.receiver_id === 'user') {
                loadMessages();
            }
        })
        .subscribe();
}

// ── Standard Helpers ──
function getStatusClass(status) {
    if (status === 'Busy') return 'busy';
    if (status === 'Offline' || status === 'Not Available') return 'offline';
    return 'available';
}

function getStatusText(status, nextAvailable) {
    if (status === 'Busy') return 'Busy Now';
    if (nextAvailable) {
        const days = Math.ceil((new Date(nextAvailable) - new Date()) / (1000 * 60 * 60 * 24));
        if (days > 0) return `Available in ${days}d`;
    }
    return 'Available';
}

function getCategoryColor(cat) {
    const colors = { 'Electrician': '#FFC107', 'Plumber': '#2196F3', 'Cobbler': '#795548', 'Babysitter': '#E91E63', 'Street Food': '#FF5722', 'Gardener': '#4CAF50', 'Cook': '#9C27B0', 'Pet Sitter': '#00BCD4' };
    return colors[cat] || '#1877F2';
}

function getCategoryIcon(cat) {
    const icons = { 'Electrician': '⚡', 'Plumber': '🔧', 'Gardener': '🌱', 'Cook': '🍳', 'Pet Sitter': '🐾', 'Babysitter': '👶', 'Street Food': '🍱', 'Cobbler': '👞' };
    return icons[cat] || '📍';
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
}

function closeBottomSheet() {
    bottomSheet.classList.remove('peek');
    bottomSheet.classList.remove('full');
    currentDetailsWorkerId = null;
}
window.closeBottomSheet = closeBottomSheet;

function resetAddWorkerForm() {
    addWorkerForm.reset();
    const previewContainer = document.getElementById('image-preview');
    if (previewContainer) {
        previewContainer.style.backgroundImage = '';
        previewContainer.querySelector('span').style.display = 'block';
    }
    if (workerCoordsInput && userLocation) {
        workerCoordsInput.value = `${userLocation[0].toFixed(6)}, ${userLocation[1].toFixed(6)}`;
    }
}

async function handleAddWorker(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-worker');
    submitBtn.disabled = true;
    submitBtn.textContent = "Processing...";

    try {
        const name = document.getElementById('worker-name').value;
        const category = document.getElementById('worker-category').value;
        const phone = document.getElementById('worker-phone').value;
        const fileInput = document.getElementById('worker-image');
        const file = fileInput.files[0];

        if (!userLocation) throw new Error("Please wait for location detection.");

        let finalImageUrl = `https://ui-avatars.com/api/?name=${name.replace(' ', '+')}&background=random`;

        // Handle Image Upload if file exists
        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('worker-images')
                .upload(filePath, file);

            if (uploadError) {
                console.error("Upload error:", uploadError);
                // Proceed with fallback avatar if upload fails, or you could throw error.
            } else {
                const { data } = supabase.storage
                    .from('worker-images')
                    .getPublicUrl(filePath);
                finalImageUrl = data.publicUrl;
            }
        }

        const { error } = await supabase.from('workers').insert({
            name,
            category,
            phone,
            latitude: userLocation[0],
            longitude: userLocation[1],
            color_code: getCategoryColor(category),
            image_url: finalImageUrl
        });

        if (error) throw error;
        alert("Worker registered successfully!");
        addWorkerModal.classList.remove('open');
        resetAddWorkerForm();
        fetchWorkers();
    } catch (err) {
        alert(err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Register Worker";
    }
}

// ── Saved Workers Logic ──
async function fetchSavedWorkerIds() {
    try {
        const { data, error } = await supabase.from('saved_workers').select('worker_id').eq('user_id', 'user');
        if (error) throw error;
        savedWorkerIds = new Set(data.map(d => d.worker_id));
    } catch (e) { console.error(e); }
}

window.toggleSaveWorker = async (workerId) => {
    try {
        if (savedWorkerIds.has(workerId)) {
            await supabase.from('saved_workers').delete().eq('worker_id', workerId);
            savedWorkerIds.delete(workerId);
        } else {
            await supabase.from('saved_workers').insert({ worker_id: workerId });
            savedWorkerIds.add(workerId);
        }
        const worker = allWorkers.find(w => w.id === workerId);
        if (worker) openWorkerDetails(worker);
        renderSavedWorkers();
    } catch (e) { alert("Action failed"); }
};

function renderSavedWorkers() {
    const listEl = document.getElementById('saved-worker-list');
    if (!listEl) return;
    const saved = allWorkers.filter(w => savedWorkerIds.has(w.id));
    if (saved.length === 0) {
        listEl.innerHTML = '<div class="sheet-placeholder"><p>No workers saved yet.</p></div>';
        return;
    }
    listEl.innerHTML = saved.map(worker => `
        <div class="disc-worker-card" onclick="handleDiscoveryCardClick(${JSON.stringify(worker).replace(/"/g, '&quot;')})">
            <div class="disc-img-container">
                <img src="${worker.image_url}" class="disc-worker-img" alt="${worker.name}" style="width:90px; height:90px; border-radius:16px; object-fit:cover" />
            </div>
            <div class="disc-worker-info">
                <span class="disc-worker-name">${worker.name}</span>
                <p class="disc-cat">${worker.category}</p>
                <span class="disc-dist">★ ${worker.rating ? worker.rating.toFixed(1) : '4.5'}</span>
            </div>
        </div>
    `).join('');
}

// ── Requests Logic ──
async function renderRequests() {
    const listEl = document.getElementById('requests-list');
    if (!listEl) return;

    // Simplification: Requests = Workers user has sent messages to
    const { data: msgs } = await supabase.from('messages').select('receiver_id').eq('sender_id', 'user');
    const messagedIds = new Set(msgs?.map(m => m.receiver_id) || []);

    const requested = allWorkers.filter(w => messagedIds.has(w.id));
    if (requested.length === 0) {
        listEl.innerHTML = '<div class="sheet-placeholder"><p>You haven\'t made any requests yet.</p></div>';
        return;
    }
    listEl.innerHTML = requested.map(worker => `
        <div class="disc-worker-card" onclick="window.startChat(${JSON.stringify(worker).replace(/"/g, '&quot;')})">
            <div class="disc-img-container">
                <img src="${worker.image_url}" class="disc-worker-img" alt="${worker.name}" style="width:70px; height:70px; border-radius:50%; object-fit:cover" />
            </div>
            <div class="disc-worker-info">
                <span class="disc-worker-name">${worker.name}</span>
                <p class="disc-cat">${worker.category}</p>
                <span class="status-tag available">In Progress</span>
            </div>
        </div>
    `).join('');
}

window.addEventListener('DOMContentLoaded', init);
