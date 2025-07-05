document.addEventListener('DOMContentLoaded', () => {
    // 檢查必要的 API 是否存在
    if (!('geolocation' in navigator)) {
        alert('您的瀏覽器不支援 GPS 定位功能。');
        return;
    }

    // DOM 元素
    const distanceEl = document.getElementById('distance');
    const speedEl = document.getElementById('speed');
    const statusEl = document.getElementById('status');
    const toggleBtn = document.getElementById('toggleBtn');
    const resetBtn = document.getElementById('resetBtn');

    // 應用程式狀態變數
    let isTracking = false;
    let watchId = null;
    let totalDistance = 0;
    let lastPosition = null;
    let lastKmMark = 0; // 上次震動的公里數
    let wakeLock = null; // 用於螢幕喚醒鎖

    // 從 localStorage 載入儲存的距離
    const savedDistance = localStorage.getItem('totalDistance');
    if (savedDistance) {
        totalDistance = parseFloat(savedDistance);
        updateUI();
    }

    // --- 事件監聽 ---
    toggleBtn.addEventListener('click', toggleTracking);
    resetBtn.addEventListener('click', resetTracking);

    // --- 核心功能 ---
    function toggleTracking() {
        if (isTracking) {
            stopTracking();
        } else {
            startTracking();
        }
    }

    async function startTracking() {
        // 請求螢幕喚醒鎖
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                statusEl.textContent = '螢幕喚醒鎖已啟用。';
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
                statusEl.textContent = '無法啟用螢幕喚醒鎖。';
            }
        }

        statusEl.textContent = '正在取得 GPS 訊號...';
        lastPosition = null; // 每次重新開始都重置上次位置

        const options = {
            enableHighAccuracy: true, // 請求高精度位置
            timeout: 10000,           // 10秒超時
            maximumAge: 0             // 不使用快取位置
        };
        
        watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
        isTracking = true;
        updateUI();
    }

    function stopTracking() {
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        // 釋放螢幕喚醒鎖
        if (wakeLock) {
            wakeLock.release();
            wakeLock = null;
        }
        isTracking = false;
        lastPosition = null;
        statusEl.textContent = '紀錄已停止。';
        updateUI();
    }

    function resetTracking() {
        if (confirm('確定要將距離歸零嗎？')) {
            stopTracking();
            totalDistance = 0;
            lastKmMark = 0;
            localStorage.setItem('totalDistance', totalDistance.toString());
            statusEl.textContent = '距離已重設。請按下「開始」來紀錄。';
            updateUI();
        }
    }
    
    function handleSuccess(position) {
        statusEl.textContent = '正在紀錄中...';
        const { latitude, longitude, speed } = position.coords;
        const currentSpeed = speed ? (speed * 3.6).toFixed(0) : 0; // m/s 轉 km/h
        speedEl.textContent = currentSpeed;
        
        if (lastPosition) {
            const distanceIncrement = calculateDistance(
                lastPosition.latitude,
                lastPosition.longitude,
                latitude,
                longitude
            );
            totalDistance += distanceIncrement;
        }
        
        lastPosition = { latitude, longitude };
        
        // 檢查是否跨越了新的公里數
        if (Math.floor(totalDistance) > lastKmMark) {
            lastKmMark = Math.floor(totalDistance);
            vibrateOnKm();
        }

        localStorage.setItem('totalDistance', totalDistance.toString());
        updateUI();
    }

    function handleError(error) {
        let message = '';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = '您拒絕了 GPS 定位請求。';
                break;
            case error.POSITION_UNAVAILABLE:
                message = '無法取得目前位置資訊。';
                break;
            case error.TIMEOUT:
                message = '取得位置資訊超時。';
                break;
            default:
                message = '發生未知錯誤。';
                break;
        }
        statusEl.textContent = message;
        stopTracking();
    }

    function updateUI() {
        distanceEl.textContent = totalDistance.toFixed(3);
        if (isTracking) {
            toggleBtn.textContent = '停止紀錄';
            toggleBtn.classList.add('tracking');
        } else {
            toggleBtn.textContent = '開始紀錄';
            toggleBtn.classList.remove('tracking');
            speedEl.textContent = '0';
        }
    }
    
    // 海弗森公式 (Haversine formula) 計算兩點間距離 (公里)
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // 地球半徑 (公里)
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            0.5 - Math.cos(dLat)/2 + 
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            (1 - Math.cos(dLon)) / 2;

        return R * 2 * Math.asin(Math.sqrt(a));
    }

    function vibrateOnKm() {
        // 檢查瀏覽器是否支援震動 API
        if ('vibrate' in navigator) {
            // 震動 500 毫秒
            navigator.vibrate(500);
            console.log(`已達 ${lastKmMark} 公里，震動！`);
        }
    }

    // 註冊 Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker 註冊成功:', reg))
            .catch(err => console.error('Service Worker 註冊失敗:', err));
    }
});