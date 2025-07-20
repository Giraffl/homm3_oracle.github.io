class Game {
    constructor() {
        this.userId = localStorage.getItem('userId');
        this.username = localStorage.getItem('username');
        this.mapData = null;
        this.heroX = null;
        this.heroY = null;
        this.castleX = null;
        this.castleY = null;
        this.currentDay = 1;
        this.remainingSteps = 20;
        this.tileSize = 50;
        this.viewportSize = 20;
        this.isMoving = false;

        // Добавляем систему ресурсов
        this.resources = {
            wood: 0,
            ore: 0,
            gold: 0
        };

        // Добавляем систему захваченных зданий
        this.capturedBuildings = {
            sawmills: [], // [{x, y, level, production}]
            mines: [] // [{x, y, level, oreProduction, goldProduction}]
        };

        // Константы для корректировки отображения героя
        this.HERO_X_OFFSET = 1;
        this.HERO_Y_OFFSET = 1;

        // Добавляем переменные для пути
        this.currentPath = []; // Текущий путь для перемещения
        this.isFollowingPath = false; // Флаг, указывающий, что герой следует по пути
        this.pendingPath = null; // Добавляем переменную для хранения предварительного пути
        this.lastClickedTile = null; // Добавляем переменную для отслеживания последнего кликнутого тайла

        // Добавляем хранилище для открытых клеток (туман войны)
        this.exploredTiles = {}; // Объект для отслеживания исследованных областей
        this.fogOfWarRadius = 5; // Радиус видимости героя (сколько клеток вокруг героя открывается)

        // Объект с описаниями типов местности
        this.terrainTypes = {
            'G': 'Трава',
            'F': 'Лес',
            'D': 'Пустыня',
            'W': 'Вода',
            'B': 'Мост',
            'C': 'Замок',
            'E': 'Вход в замок',
            'S': 'Лесопилка',
            'T': 'Вход в лесопилку',
            'M': 'Шахта',
            'N': 'Вход в шахту'
        };

        // Добавляем переменные для мини-карты
        this.minimapContainer = null;
        this.minimap = null;
        this.minimapTileSize = 6; // Размер тайла на мини-карте в пикселях

        // Константы для производства ресурсов
        this.BUILDING_LEVELS = {
            SAWMILL: {
                1: { wood: 60, upgradeCost: { wood: 100, ore: 60, gold: 40 } },
                2: { wood: 90, upgradeCost: { wood: 150, ore: 90, gold: 60 } },
                3: { wood: 135, upgradeCost: { wood: 225, ore: 135, gold: 90 } },
                4: { wood: 203, upgradeCost: { wood: 338, ore: 203, gold: 135 } },
                5: { wood: 304, upgradeCost: { wood: 507, ore: 304, gold: 203 } },
                6: { wood: 456, upgradeCost: { wood: 761, ore: 457, gold: 304 } },
                7: { wood: 683, upgradeCost: { wood: 1142, ore: 685, gold: 457 } },
                8: { wood: 1025, upgradeCost: { wood: 1713, ore: 1028, gold: 685 } },
                9: { wood: 1538, upgradeCost: { wood: 2570, ore: 1542, gold: 1028 } },
                10: { wood: 2307, upgradeCost: null }
            },
            MINE: {
                1: { ore: 50, gold: 25, upgradeCost: { wood: 100, ore: 60, gold: 40 } },
                2: { ore: 75, gold: 38, upgradeCost: { wood: 150, ore: 90, gold: 60 } },
                3: { ore: 113, gold: 57, upgradeCost: { wood: 225, ore: 135, gold: 90 } },
                4: { ore: 170, gold: 85, upgradeCost: { wood: 338, ore: 203, gold: 135 } },
                5: { ore: 255, gold: 128, upgradeCost: { wood: 507, ore: 304, gold: 203 } },
                6: { ore: 383, gold: 192, upgradeCost: { wood: 761, ore: 457, gold: 304 } },
                7: { ore: 574, gold: 288, upgradeCost: { wood: 1142, ore: 685, gold: 457 } },
                8: { ore: 861, gold: 432, upgradeCost: { wood: 1713, ore: 1028, gold: 685 } },
                9: { ore: 1292, gold: 648, upgradeCost: { wood: 2570, ore: 1542, gold: 1028 } },
                10: { ore: 1938, gold: 972, upgradeCost: null }
            }
        };

        if (!this.userId || !this.username) {
            // Если пользователь не авторизован, перенаправляем на страницу входа
            window.location.href = 'index.html';
            return;
        }

        this.init();
    }

    async init() {
        // Отображаем имя игрока
        document.getElementById('playerName').textContent = `Игрок: ${this.username}`;

        // Добавляем обработчик для кнопки выхода
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Инициализируем переменные для отслеживания касаний
        this.lastTouchedTile = null;
        this.lastTouchTime = 0;

        // Загружаем состояние игры
        await this.loadGameState();

        // === Приветственный Swal ===
        await Swal.fire({
            title: 'Добро пожаловать!',
            html: `Это обучающая карта "Героев Меча и Магии III"! Неважно, новичок ли вы или умудрённый опытом воин, вы выбрали правильное место. Когда будете готовы, нажмите на кнопку с галочкой.<br><br><b>Отметим, что игра находится на стадии тестирования.</b>`,
            confirmButtonText: '✔',
            confirmButtonColor: '#4CAF50',
            allowOutsideClick: false,
            allowEscapeKey: false
        });

        // Загружаем исследованные области
        await this.loadExploredTiles();

        // Загружаем информацию о захваченных зданиях
        await this.loadCapturedBuildings();

        // Убеждаемся, что начальная позиция героя всегда исследована
        const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
        const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;

        // Обновляем начальную позицию героя и ближайшие клетки в радиусе видимости
        for (let y = correctedHeroY - this.fogOfWarRadius; y <= correctedHeroY + this.fogOfWarRadius; y++) {
            for (let x = correctedHeroX - this.fogOfWarRadius; x <= correctedHeroX + this.fogOfWarRadius; x++) {
                // Проверяем, что координаты не выходят за пределы карты
                if (x < 0 || y < 0) continue;

                // Вычисляем расстояние от героя до клетки (манхэттенское расстояние)
                const distance = Math.abs(x - correctedHeroX) + Math.abs(y - correctedHeroY);

                // Если клетка находится в пределах радиуса видимости, отмечаем её как исследованную
                if (distance <= this.fogOfWarRadius) {
                    const tileKey = `${x},${y}`;
                    this.exploredTiles[tileKey] = true;
                }
            }
        }

        // Сохраняем начальное состояние исследованных областей
        await this.saveExploredTiles();
        await this.loadUserArmy();

        // Отрисовываем карту
        this.drawMap();

        // Обработка изменения размера окна
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Добавляем обработчик клавиатуры
        window.addEventListener('keydown', this.handleKeyDown.bind(this));

        // Загрузка изображения героя
        const heroImage = new Image();
        heroImage.src = 'hero.svg';
        heroImage.onload = () => {
            this.drawMap();
        };

        // Инициализируем мини-карту
        this.initMinimap();
    }

    // Метод для выхода из аккаунта
    async logout() {
        try {
            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'logout',
                    userId: this.userId
                })
            });

            const data = await response.json();

            // Очищаем локальное хранилище и перенаправляем на меню
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem(`exploredTiles_${this.userId}`);

            window.location.href = 'menu.html';
        } catch (error) {
            console.error('Ошибка при выходе:', error);

            // В случае ошибки также очищаем хранилище и перенаправляем на меню
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem(`exploredTiles_${this.userId}`);

            window.location.href = 'menu.html';
        }
    }

    async loadGameState() {
        try {
            const response = await fetch(`/api?action=get_game_state&userId=${this.userId}`);
            const data = await response.json();

            if (data.success) {
                this.mapData = data.state.mapData;
                this.heroX = parseInt(data.state.heroX);
                this.heroY = parseInt(data.state.heroY);
                this.castleX = parseInt(data.state.castleX);
                this.castleY = parseInt(data.state.castleY);
                this.currentDay = parseInt(data.state.currentDay);
                this.remainingSteps = parseFloat(data.state.remainingSteps);

                // Выводим исходные координаты героя
                console.log("Loaded game state:", this.heroX, this.heroY, this.castleX, this.castleY);
                console.log("Day:", this.currentDay, "Remaining steps:", this.remainingSteps);

                // Обновляем информацию о дне и шагах в интерфейсе
                this.updateDayAndStepsInfo();

                // Загружаем ресурсы
                await this.loadResources();
            } else {
                alert('Ошибка загрузки состояния игры');
            }
        } catch (error) {
            console.error('Ошибка при загрузке состояния игры:', error);
            alert('Произошла ошибка при загрузке игры');
        }
    }

    async loadResources() {
        try {
            const response = await fetch('/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_user_resources',
                    userId: this.userId
                })
            });

            const data = await response.json();
            if (data.success) {
                this.resources = data.resources;
                this.updateResourcesDisplay();
            }
        } catch (error) {
            console.error('Ошибка при загрузке ресурсов:', error);
        }
    }

    updateResourcesDisplay() {
        // Создаем контейнер для ресурсов, если его еще нет
        let resourcesContainer = document.querySelector('.resources-container');
        if (!resourcesContainer) {
            resourcesContainer = document.createElement('div');
            resourcesContainer.className = 'resources-container';
            document.querySelector('.game-header').appendChild(resourcesContainer);
        }

        // Обновляем содержимое контейнера
        resourcesContainer.innerHTML = `
            <div class="resource">
                <i class="fas fa-tree"></i>
                <span>${this.resources.wood}</span>
            </div>
            <div class="resource">
                <i class="fas fa-mountain"></i>
                <span>${this.resources.ore}</span>
            </div>
            <div class="resource">
                <i class="fas fa-coins"></i>
                <span>${this.resources.gold}</span>
            </div>
        `;

        // Обновляем ресурсы в окне замка, если оно открыто
        const castleWindow = document.querySelector('.castle-window');
        if (castleWindow) {
            const resourcesSection = castleWindow.querySelector('.castle-section');
            if (resourcesSection) {
                const resourcesContent = resourcesSection.querySelector('p');
                if (resourcesContent) {
                    resourcesContent.textContent = `Дерево: ${this.resources.wood}, Руда: ${this.resources.ore}, Золото: ${this.resources.gold}`;
                }
            }
        }
    }

    // Метод для загрузки исследованных областей
    async loadExploredTiles() {
        try {
            console.log('Начинаем загрузку исследованных областей. userId:', this.userId);

            // Сначала пробуем загрузить с сервера
            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_explored_tiles',
                    userId: this.userId
                })
            });

            const data = await response.json();
            console.log('Ответ от сервера при загрузке:', data);

            if (data.success && data.exploredTiles) {
                this.exploredTiles = data.exploredTiles;
                console.log('Загружены исследованные области с сервера:', Object.keys(this.exploredTiles).length);
                return;
            } else {
                console.warn('Сервер вернул успех, но нет данных:', data);
            }
        } catch (error) {
            console.error('Ошибка при загрузке исследованных областей с сервера:', error);
        }

        // Если не удалось загрузить с сервера, пробуем из localStorage (для обратной совместимости)
        const exploredTilesData = localStorage.getItem(`exploredTiles_${this.userId}`);
        if (exploredTilesData) {
            try {
                this.exploredTiles = JSON.parse(exploredTilesData);
                console.log('Загружены исследованные области из localStorage:', Object.keys(this.exploredTiles).length);

                // Синхронизируем с сервером
                this.saveExploredTiles();
            } catch (e) {
                console.error('Ошибка при загрузке исследованных областей из localStorage:', e);
                this.exploredTiles = {};
            }
        } else {
            this.exploredTiles = {};
            console.log('Исследованные области не найдены, создаем новые');
        }
    }

    // Метод для сохранения исследованных областей
    async saveExploredTiles() {
        console.log('Начинаем сохранение исследованных областей. userId:', this.userId);
        console.log('Количество исследованных областей для сохранения:', Object.keys(this.exploredTiles).length);

        try {
            // Сохраняем на сервере
            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'save_explored_tiles',
                    userId: this.userId,
                    exploredTiles: this.exploredTiles
                })
            });

            const data = await response.json();

            if (data.success) {
                console.log('Сохранены исследованные области на сервере:', Object.keys(this.exploredTiles).length);
            } else {
                console.error('Ошибка при сохранении на сервере:', data.message);
            }
        } catch (e) {
            console.error('Ошибка при сохранении исследованных областей на сервере:', e);
        }

        // Также сохраняем в localStorage (для офлайн-поддержки)
        try {
            localStorage.setItem(`exploredTiles_${this.userId}`, JSON.stringify(this.exploredTiles));
            console.log('Сохранены исследованные области в localStorage:', Object.keys(this.exploredTiles).length);
        } catch (e) {
            console.error('Ошибка при сохранении исследованных областей в localStorage:', e);
        }
    }

    // Метод для проверки, исследована ли клетка
    isTileExplored(x, y) {
        return this.exploredTiles[`${x},${y}`] === true;
    }

    // Метод для обновления исследованных областей на основе текущей позиции героя
    async updateExploredTiles() {
        // Получаем корректированную позицию героя
        const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
        const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;

        console.log('Обновление исследованных областей от позиции:', correctedHeroX, correctedHeroY);

        // Массив для отслеживания новых исследованных клеток
        const newlyExploredTiles = [];

        // Обновляем видимость в радиусе вокруг героя
        for (let y = correctedHeroY - this.fogOfWarRadius; y <= correctedHeroY + this.fogOfWarRadius; y++) {
            for (let x = correctedHeroX - this.fogOfWarRadius; x <= correctedHeroX + this.fogOfWarRadius; x++) {
                // Проверяем, что координаты не выходят за пределы карты
                if (x < 0 || y < 0) continue;

                // Вычисляем расстояние от героя до клетки (манхэттенское расстояние)
                const distance = Math.abs(x - correctedHeroX) + Math.abs(y - correctedHeroY);

                // Если клетка находится в пределах радиуса видимости и еще не исследована
                if (distance <= this.fogOfWarRadius) {
                    const tileKey = `${x},${y}`;
                    if (!this.exploredTiles[tileKey]) {
                        this.exploredTiles[tileKey] = true;
                        newlyExploredTiles.push({ x, y });
                    }
                }
            }
        }

        // Сохраняем обновленные данные
        if (newlyExploredTiles.length > 0) {
            await this.saveExploredTiles();
        }

        // Обновляем видимость существующих тайлов
        if (newlyExploredTiles.length > 0) {
            console.log(`Обнаружено ${newlyExploredTiles.length} новых исследованных клеток`);

            // Обновляем отображение этих клеток на карте
            newlyExploredTiles.forEach(({ x, y }) => {
                const tile = document.querySelector(`.tile[data-x="${x}"][data-y="${y}"]`);
                if (tile) {
                    // Определяем, что клетка теперь видима
                    const isCurrentlyVisible = true;
                    const isExplored = true;

                    // Обновляем визуализацию тайла
                    this.updateTileFogOfWar(tile, isExplored, isCurrentlyVisible);
                }
            });
        }

        // Обновляем мини-карту
        this.drawMinimap();

        return newlyExploredTiles.length; // Возвращаем количество новых исследованных клеток
    }

    // Обновляем визуализацию тайлов тумана войны
    updateTileFogOfWar(tile, isExplored, isCurrentlyVisible) {
        // Если клетка не исследована и не в зоне видимости, добавляем туман войны немедленно
        if (!isExplored && !isCurrentlyVisible) {
            tile.classList.add('fog-of-war');
        } else {
            // Сначала удаляем класс тумана войны, если он есть
            tile.classList.remove('fog-of-war');
        }
    }

    async drawMap() {
        const gameMap = document.getElementById('gameMap');
        gameMap.innerHTML = '';

        // Получаем размер доступной области
        const mapAreaWidth = gameMap.clientWidth;
        const mapAreaHeight = gameMap.clientHeight;

        // Разбиваем карту на строки
        const mapLines = this.mapData.split('\n');

        // Определяем максимальный размер карты
        const mapWidth = mapLines[0] ? mapLines[0].length : 0;
        const mapHeight = mapLines.length;

        // Определяем оптимальное количество видимых тайлов
        // Используем меньшее из двух значений, чтобы сохранить квадратные тайлы
        this.viewportSize = Math.min(
            Math.floor(mapAreaWidth / 40), // Минимальный размер тайла 40px
            Math.floor(mapAreaHeight / 40),
            Math.min(mapWidth, mapHeight) // Не больше размера карты
        );

        // Убедимся, что viewportSize не меньше 10 и не больше 30
        this.viewportSize = Math.max(10, Math.min(30, this.viewportSize));

        // Расчитываем размер тайла на основе доступного пространства
        this.tileSize = Math.min(
            Math.floor(mapAreaWidth / this.viewportSize),
            Math.floor(mapAreaHeight / this.viewportSize)
        );

        console.log("Map area size:", mapAreaWidth, mapAreaHeight);
        console.log("Map dimensions:", mapWidth, mapHeight);
        console.log("Viewport size:", this.viewportSize);
        console.log("Calculated tile size:", this.tileSize);

        // Определяем видимую область вокруг героя
        const startY = Math.max(0, Math.floor(this.heroY - this.viewportSize / 2));
        const endY = Math.min(mapLines.length, startY + this.viewportSize);

        const startX = Math.max(0, Math.floor(this.heroX - this.viewportSize / 2));
        const endX = Math.min(mapWidth, startX + this.viewportSize);

        console.log("Hero position:", this.heroX, this.heroY);
        console.log("Viewport coordinates:", startX, endX, startY, endY);

        // Создаем контейнер для карты
        const mapContainer = document.createElement('div');
        mapContainer.style.position = 'relative';
        mapContainer.style.width = `${(endX - startX) * this.tileSize}px`;
        mapContainer.style.height = `${(endY - startY) * this.tileSize}px`;
        mapContainer.style.margin = '0 auto';
        gameMap.appendChild(mapContainer);

        // Добавляем обработчик правого клика для отмены пути
        mapContainer.addEventListener('contextmenu', (event) => {
            event.preventDefault(); // Отменяем стандартное контекстное меню

            if (this.isFollowingPath || this.pendingPath) {
                console.log('Отмена пути по правому клику');
                this.cancelPath();

                // Показываем уведомление
                Swal.fire({
                    title: 'Путь отменен',
                    text: 'Движение по пути прервано',
                    icon: 'info',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 1500
                });
            }
        });

        console.log("Map container size:", mapContainer.style.width, mapContainer.style.height);

        // Определяем тип местности под героем с учетом коррекции
        const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
        const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;
        const heroTerrainType = this.getTerrainType(correctedHeroX, correctedHeroY);

        // Создаем информационную панель
        const infoPanel = document.createElement('div');
        infoPanel.className = 'info-panel';
        infoPanel.innerHTML = `
            <div class="hero-info">
                <h3>Информация о герое</h3>
                <p>Позиция: X=${correctedHeroX}, Y=${correctedHeroY}</p>
                <p>Местность: ${this.terrainTypes[heroTerrainType] || 'Неизвестно'}</p>
            </div>
            <div class="viewport-info">
                <h3>Видимая область</h3>
                <p>Размер области: ${this.viewportSize}x${this.viewportSize}</p>
                <p>Границы: X(${startX}-${endX}), Y(${startY}-${endY})</p>
                <p>Всего видимых клеток: ${(endX - startX) * (endY - startY)}</p>
            </div>
            <div class="hover-info">
                <h3>Информация о блоке</h3>
                <p id="hoverCoords">Наведите на блок</p>
                <p id="hoverTerrain"></p>
            </div>
        `;
        gameMap.appendChild(infoPanel);

        // Рисуем тайлы
        for (let y = startY; y < endY; y++) {
            if (y >= mapLines.length) continue;
            const line = mapLines[y];

            for (let x = startX; x < endX; x++) {
                if (x >= line.length) continue;

                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.style.width = `${this.tileSize}px`;
                tile.style.height = `${this.tileSize}px`;

                // Сохраняем координаты и тип местности как атрибуты
                tile.dataset.x = x;
                tile.dataset.y = y;
                tile.dataset.terrain = line[x];

                // Проверяем, исследована ли клетка
                const isExplored = this.isTileExplored(x, y);

                // Корректируем координаты героя для сравнения
                const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
                const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;

                // Вычисляем расстояние от героя до клетки (манхэттенское расстояние)
                const distance = Math.abs(x - correctedHeroX) + Math.abs(y - correctedHeroY);

                // Определяем, видима ли клетка в данный момент (находится ли она в радиусе видимости героя)
                const isCurrentlyVisible = distance <= this.fogOfWarRadius;

                // Определяем тип местности для всех клеток
                const terrain = line[x];
                switch (terrain) {
                    case 'G':
                        tile.classList.add('tile-grass');
                        break;
                    case 'F':
                        tile.classList.add('tile-forest');
                        break;
                    case 'D':
                        tile.classList.add('tile-desert');
                        break;
                    case 'W':
                        tile.classList.add('tile-water');
                        break;
                    case 'B':
                        tile.classList.add('tile-bridge');
                        break;
                    case 'C': {
                        const castleType = this.getCastleType(x, y);
                        if (castleType === 'enemy') {
                            tile.classList.add('tile-castle-enemy');
                            tile.style.backgroundImage = "url('textures/castle_enemy.png')";
                        } else {
                            tile.classList.add('tile-castle');
                        }
                        break;
                    }
                    case 'E':
                        tile.classList.add('tile-castle-door');
                        break;
                    case 'X':
                        tile.classList.add('tile-castle-enemy');
                        tile.style.backgroundImage = "url('textures/castle_enemy.png')";
                        break;
                    case 'Y':
                        tile.classList.add('tile-castle-door-enemy');
                        tile.style.backgroundImage = "url('textures/castle_enemy_door.png')";
                        break;
                    case 'S':
                        tile.classList.add('tile-sawmill');
                        break;
                    case 'T':
                        tile.classList.add('tile-sawmill-door');
                        break;
                    case 'M':
                        tile.classList.add('tile-mine');
                        break;
                    case 'N':
                        tile.classList.add('tile-mine-door');
                        break;
                }

                // Применяем туман войны с использованием нового метода
                this.updateTileFogOfWar(tile, isExplored, isCurrentlyVisible);

                // Позиционируем тайл относительно контейнера
                tile.style.left = `${(x - startX) * this.tileSize}px`;
                tile.style.top = `${(y - startY) * this.tileSize}px`;

                // Добавляем обработчики событий наведения мыши и касания
                tile.addEventListener('mouseover', this.handleTileHover.bind(this));
                tile.addEventListener('mouseout', this.handleTileHoverEnd.bind(this));
                tile.addEventListener('touchstart', this.handleTileTouch.bind(this));
                tile.addEventListener('touchend', this.handleTileHoverEnd.bind(this));
                tile.addEventListener('click', this.handleTileClick.bind(this));

                mapContainer.appendChild(tile);
            }
        }

        // После отрисовки всех тайлов, но до героя — отрисовываем армии
        if (this.userArmy && Array.isArray(this.userArmy)) {
            // Группируем армии по координатам
            const armyByTile = {};
            this.userArmy.forEach(unit => {
                const key = `${unit.x},${unit.y}`;
                if (!armyByTile[key]) armyByTile[key] = [];
                armyByTile[key].push(unit);
            });
            // Для каждой клетки с армией
            Object.entries(armyByTile).forEach(([key, units]) => {
                const [x, y] = key.split(',').map(Number);
                // Пропускаем если армия вне видимой области
                if (x < startX || x >= endX || y < startY || y >= endY) return;
                // Базовые координаты клетки
                const baseLeft = (x - startX) * this.tileSize;
                const baseTop = (y - startY) * this.tileSize;
                // Смещения для разных типов (по углам)
                const offsets = {
                    'ARCHER': { dx: -this.tileSize * 0.18, dy: this.tileSize * 0.18 }, // левый-низ
                    'SWORDSMAN': { dx: this.tileSize * 0.18, dy: this.tileSize * 0.18 }, // правый-низ
                    'TANK': { dx: 0, dy: -this.tileSize * 0.18 }, // центр-верх
                };
                // Если армия стоит на замке — дополнительно сдвигаем
                const isCastle = this.getTerrainType(x, y) === 'C';
                // Группируем по типу и суммируем count
                const groupedByType = {};
                units.forEach(unit => {
                    if (!groupedByType[unit.unitType]) {
                        groupedByType[unit.unitType] = { ...unit, count: 0 };
                    }
                    groupedByType[unit.unitType].count += unit.count;
                });
                Object.values(groupedByType).forEach((unit, idx) => {
                    let dx = 0, dy = 0;
                    if (offsets[unit.unitType]) {
                        dx = offsets[unit.unitType].dx;
                        dy = offsets[unit.unitType].dy;
                    } else {
                        const angle = (2 * Math.PI * idx) / Object.keys(groupedByType).length;
                        dx = Math.cos(angle) * this.tileSize * 0.18;
                        dy = Math.sin(angle) * this.tileSize * 0.18;
                    }
                    if (isCastle) {
                        if (unit.unitType === 'ARCHER') dx = -this.tileSize * 0.28;
                        if (unit.unitType === 'SWORDSMAN') dx = this.tileSize * 0.28;
                        if (unit.unitType === 'TANK') dy = -this.tileSize * 0.28;
                    }
                    let icon = '';
                    if (["ARCHER", "SWORDSMAN", "TANK"].includes(unit.unitType)) {
                        icon = `<img src='textures/${unit.unitType}.png' alt='' style='width:${Math.floor(this.tileSize*0.8)}px;height:${Math.floor(this.tileSize*0.8)}px;display:block;'>`;
                    }
                    const div = document.createElement('div');
                    div.className = 'army-unit';
                    div.style.position = 'absolute';
                    div.style.left = `${baseLeft + dx}px`;
                    div.style.top = `${baseTop + dy}px`;
                    div.style.width = `${Math.floor(this.tileSize*0.8)}px`;
                    div.style.height = `${Math.floor(this.tileSize*0.8)}px`;
                    div.style.pointerEvents = 'auto';
                    div.style.zIndex = 50;
                    div.innerHTML = `
                        <div class="army-unit-inner">
                            ${icon}
                            <span class='army-count'>${unit.count}</span>
                        </div>
                    `;
                    div.title = `${unit.unitType} (${unit.count})\nАтака: ${unit.attack}, Защита: ${unit.defense}, Здоровье: ${unit.health}`;
                    div.onclick = (e) => {
                        e.stopPropagation();
                        this.selectArmyUnit(unit);
                    };
                    mapContainer.appendChild(div);
                });
            });
        }

        // Создаем героя
        const hero = document.createElement('div');
        hero.className = 'hero';
        hero.style.width = `${this.tileSize}px`;
        hero.style.height = `${this.tileSize}px`;

        // Рассчитываем позицию героя относительно видимой области
        const heroPixelX = ((this.heroX - startX) * this.tileSize);
        const heroPixelY = ((this.heroY - startY) * this.tileSize);

        // Компенсируем смещение героя на 1 блок вниз и вправо
        hero.style.left = `${heroPixelX - (this.HERO_X_OFFSET * this.tileSize)}px`;
        hero.style.top = `${heroPixelY - (this.HERO_Y_OFFSET * this.tileSize)}px`;

        // Добавляем отладочную информацию для позиции героя
        console.log("Hero coordinates:", this.heroX, this.heroY);
        console.log("Viewport start:", startX, startY);
        console.log("Hero pixel position before adjustment:", heroPixelX, heroPixelY);
        console.log("Hero pixel position after adjustment:",
            heroPixelX - (this.HERO_X_OFFSET * this.tileSize),
            heroPixelY - (this.HERO_Y_OFFSET * this.tileSize));

        mapContainer.appendChild(hero);

        // После отрисовки всех тайлов подсвечиваем позицию героя
        setTimeout(() => {
            this.updateHeroInfo();
        }, 100);

        // Обновляем исследованные области на основе текущей позиции героя
        await this.updateExploredTiles();

        // Обновляем мини-карту
        this.drawMinimap();
    }

    async moveHero(newX, newY) {
        if (this.isMoving) return;

        this.isMoving = true;
        console.log('Начало движения. Текущие шаги:', this.remainingSteps);

        try {
            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'move_hero',
                    userId: this.userId,
                    newX: newX,
                    newY: newY
                })
            });

            const data = await response.json();
            console.log('Ответ сервера (данные):', data);
            console.log('Ответ сервера (структура):', JSON.stringify(data));

            if (data.success) {
                console.log('Движение успешно. Новое состояние:', data.state);

                // Обновляем позицию героя
                this.heroX = newX;
                this.heroY = newY;

                // Обновляем информацию о дне и шагах
                if (data.state) {
                    console.log('Обновление состояния игры');
                    console.log('Старые значения - день:', this.currentDay, 'шаги:', this.remainingSteps);

                    if (typeof data.state.currentDay !== 'undefined') {
                        this.currentDay = parseInt(data.state.currentDay);
                        console.log('Установлен новый день:', this.currentDay);
                    }
                    if (typeof data.state.remainingSteps !== 'undefined') {
                        this.remainingSteps = parseFloat(data.state.remainingSteps);
                        console.log('Установлены новые шаги:', this.remainingSteps);
                    }

                    console.log('Новые значения - день:', this.currentDay, 'шаги:', this.remainingSteps);

                    // Принудительно обновляем UI
                    this.updateDayAndStepsInfo();

                    // Если начался новый день, показываем сообщение
                    if (data.state.newDay) {
                        await Swal.fire({
                            title: 'Новый день!',
                            text: `Начался день ${this.currentDay}`,
                            icon: 'info',
                            confirmButtonText: 'OK'
                        });
                    }
                } else {
                    console.error('В ответе сервера отсутствует state!');
                }

                // Перерисовываем карту
                this.drawMap();

                // Проверяем взаимодействие с замком
                await this.checkCastleInteraction();

                // Обновляем исследованные области
                await this.updateExploredTiles();
            } else {
                console.error('Ошибка движения:', data.message);
                await Swal.fire({
                    title: 'Ошибка',
                    text: data.message || 'Невозможно переместиться',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
        } catch (error) {
            console.error('Ошибка при перемещении героя:', error);
            await Swal.fire({
                title: 'Ошибка',
                text: 'Произошла ошибка при перемещении',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        } finally {
            this.isMoving = false;
            console.log('Конец движения. Текущие шаги:', this.remainingSteps);
        }
    }

    async checkCastleInteraction() {
        try {
            // Корректируем координаты героя для проверки взаимодействия с замком
            const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
            const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;
            const terrainType = this.getTerrainType(correctedHeroX, correctedHeroY);
            console.log('checkCastleInteraction: correctedHeroX=', correctedHeroX, 'correctedHeroY=', correctedHeroY, 'terrainType=', terrainType);

            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'check_castle',
                    userId: this.userId,
                    heroX: correctedHeroX,
                    heroY: correctedHeroY
                })
            });

            const data = await response.json();

            // Проверяем тип местности под героем
            // Открываем соответствующее окно в зависимости от типа местности
            if (terrainType === 'E' || terrainType === 'Y') {
                console.log('Открываем окно замка');
                this.showCastleWindow();
            } else if (terrainType === 'T') {
                console.log('Открываем окно лесопилки');
                this.showSawmillWindow();
            } else if (terrainType === 'N') {
                console.log('Открываем окно шахты');
                this.showMineWindow();
            }

            return data.canInteract;
        } catch (error) {
            console.error('Ошибка при проверке взаимодействия со зданием:', error);
            return false;
        }
    }

    // Отображение окна замка
    showCastleWindow() {
        playGameMusic && playGameMusic('castle');
        // Удаляем существующее окно, если оно есть
        const existingModal = document.querySelector('.castle-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Определяем координаты замка
        const castleX = this.heroX - this.HERO_X_OFFSET;
        const castleY = this.heroY - this.HERO_Y_OFFSET;
        const mapLines = this.mapData.split('\n');
        let castleType = this.getCastleType(castleX, castleY);
        // Если стоим на двери (E или Y), ищем замок по соседству
        const terrain = mapLines[castleY]?.[castleX];
        if (terrain === 'E' || terrain === 'Y') {
            // Проверяем соседние клетки
            const dirs = [
                {dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}
            ];
            for (const dir of dirs) {
                const nx = castleX + dir.dx;
                const ny = castleY + dir.dy;
                const t = mapLines[ny]?.[nx];
                if (t === 'C' || t === 'X') {
                    castleType = this.getCastleType(nx, ny);
                    break;
                }
            }
        }

        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.className = 'castle-modal';

        // Создаем содержимое окна
        const window = document.createElement('div');
        window.className = 'castle-window';

        // Заголовок
        const header = document.createElement('div');
        header.className = 'castle-header';
        header.innerHTML = `
            <h2>${castleType === 'enemy' ? 'Замок Чёртов' : 'Замок'}</h2>
            <button class="castle-close">&times;</button>
        `;

        // Содержимое замка
        const content = document.createElement('div');
        content.className = 'castle-content';
        if (castleType === 'enemy') {
            // Только для замка чертей: не добавляем ресурсы и армию
            content.innerHTML = `
                <div class="castle-section actions-section"></div>
            `;
        } else {
            content.innerHTML = `
                <div class="castle-section">
                    <h3>Ресурсы</h3>
                    <p>Золото: ${this.resources.gold}</p>
                    <p>Дерево: ${this.resources.wood}</p>
                    <p>Руда: ${this.resources.ore}</p>
                </div>
                <div class="castle-section army-section">
                    <h3>Армия</h3>
                    <div id="castleArmyList">Загрузка...</div>
                </div>
                <div class="castle-section actions-section"></div>
            `;
        }

        // Собираем окно
        window.appendChild(header);
        window.appendChild(content);
        modal.appendChild(window);

        // Добавляем окно на страницу
        document.body.appendChild(modal);

        // Добавляем обработчик для закрытия окна
        const closeBtn = modal.querySelector('.castle-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeCastleWindow();
            });
        }

        // Получаем информацию о замке
        this.getCastleInfo().then(castleInfo => {
            console.log('[DEBUG] showCastleWindow: получена информация о замке:', castleInfo);
            console.log('[DEBUG] showCastleWindow: тип замка:', castleType);
            console.log('[DEBUG] showCastleWindow: userId:', this.userId);
            
            const actionsSection = content.querySelector('.actions-section');
            actionsSection.innerHTML = '';
            console.log('[DEBUG] showCastleWindow: castleInfo =', castleInfo);
            console.log('[DEBUG] showCastleWindow: castleInfo?.ownerId =', castleInfo?.ownerId);
            if (castleType === 'enemy') {
                // Проверяем, захвачен ли замок этим игроком
                const isCaptured = castleInfo && castleInfo.ownerId === parseInt(this.userId);
                console.log('[DEBUG] showCastleWindow: isCaptured =', isCaptured);
                console.log('[DEBUG] showCastleWindow: castleInfo.ownerId =', castleInfo?.ownerId);
                console.log('[DEBUG] showCastleWindow: parseInt(this.userId) =', parseInt(this.userId));
                
                if (isCaptured) {
                    console.log('[DEBUG] showCastleWindow: показываем статус захваченного замка');
                    // Показываем статус захваченного замка ВСЕГДА, если ownerId совпадает
                    const capturedDiv = document.createElement('div');
                    capturedDiv.style.color = '#ff4444';
                    capturedDiv.style.fontWeight = 'bold';
                    capturedDiv.style.fontSize = '1.1em';
                    capturedDiv.style.margin = '12px 0 16px 0';
                    capturedDiv.textContent = 'Победа! Адский замок пал, и теперь его демоны служат вам. Их злоба и сила — в ваших руках!';
                    actionsSection.appendChild(capturedDiv);
                } else if (this.enemyCastleJustCaptured) {
                    // Показываем статус захваченного замка сразу после боя
                    const capturedDiv = document.createElement('div');
                    capturedDiv.style.color = '#ff4444';
                    capturedDiv.style.fontWeight = 'bold';
                    capturedDiv.style.fontSize = '1.1em';
                    capturedDiv.style.margin = '12px 0 16px 0';
                    capturedDiv.textContent = 'Победа! Адский замок пал, и теперь его демоны служат вам. Их злоба и сила — в ваших руках!';
                    actionsSection.appendChild(capturedDiv);
                    this.enemyCastleJustCaptured = false;
                } else {
                    console.log('[DEBUG] showCastleWindow: замок НЕ захвачен, показываем описание ада');
                    // Вражеский замок: стиль ада, страшное описание и кнопка захвата
                    const hellDescDiv = document.createElement('div');
                    hellDescDiv.style.color = '#ff4444';
                    hellDescDiv.style.fontWeight = 'bold';
                    hellDescDiv.style.fontSize = '1.1em';
                    hellDescDiv.style.margin = '12px 0 16px 0';
                    hellDescDiv.textContent = 'Этот замок окутан мраком и ужасом. Его стены покрыты следами древних битв, а изнутри доносятся зловещие стоны. Говорят, что души павших здесь воинов до сих пор бродят по коридорам, а сама земля вокруг пропитана злобой и отчаянием. Только самый смелый герой осмелится бросить вызов этому месту.';
                    actionsSection.appendChild(hellDescDiv);
                    const captureBtn = document.createElement('button');
                    captureBtn.className = 'castle-btn capture-btn';
                    captureBtn.textContent = 'Захватить';
                    // Красный стиль для кнопки
                    captureBtn.style.background = '#d32f2f';
                    captureBtn.style.color = '#fff';
                    captureBtn.style.border = '2px solid #b71c1c';
                    captureBtn.style.boxShadow = '0 0 12px 2px #b71c1c88';
                    captureBtn.style.fontWeight = 'bold';
                    captureBtn.style.fontSize = '1.1em';
                    captureBtn.style.padding = '12px 32px';
                    captureBtn.style.marginTop = '10px';
                    captureBtn.style.cursor = 'pointer';
                    captureBtn.onmouseover = () => { captureBtn.style.background = '#b71c1c'; };
                    captureBtn.onmouseout = () => { captureBtn.style.background = '#d32f2f'; };
                    captureBtn.onclick = () => { this.captureCastle(); };
                    actionsSection.appendChild(captureBtn);
                }
            } else {
                // Для обычного замка (не enemy)
                if (castleInfo && castleInfo.ownerId === parseInt(this.userId)) {
                    // Если замок принадлежит игроку, показываем кнопку отзыва владения и найма армии
                    const hireArmyBtn = document.createElement('button');
                    hireArmyBtn.className = 'castle-btn hire-army-btn';
                    hireArmyBtn.textContent = 'Нанять армию';
                    hireArmyBtn.addEventListener('click', () => {
                        this.showHireArmyMenu();
                    });
                    actionsSection.appendChild(hireArmyBtn);

                    const relinquishBtn = document.createElement('button');
                    relinquishBtn.className = 'castle-btn relinquish-btn';
                    relinquishBtn.textContent = 'Отозвать владение';
                    relinquishBtn.addEventListener('click', () => {
                        this.relinquishCastle();
                    });
                    actionsSection.appendChild(relinquishBtn);
                } else if (castleInfo == null || castleInfo.ownerId == null || castleInfo.ownerId !== parseInt(this.userId)) {
                    // Если замок свободен (castleInfo null или ownerId null) или принадлежит другому игроку, показываем кнопку захвата
                    const captureBtn = document.createElement('button');
                    captureBtn.className = 'castle-btn capture-btn';
                    captureBtn.textContent = 'Захватить замок';
                    captureBtn.addEventListener('click', () => {
                        this.captureCastle();
                    });
                    actionsSection.appendChild(captureBtn);
                }
            }
        });

        // После добавления окна на страницу, подгружаем армию
        this.loadUserArmyForCastle();
    }

    // Получение информации о замке
    async getCastleInfo() {
        try {
            const heroX = this.heroX - this.HERO_X_OFFSET;
            const heroY = this.heroY - this.HERO_Y_OFFSET;
            
            console.log('[DEBUG] getCastleInfo: координаты героя:', this.heroX, this.heroY);
            console.log('[DEBUG] getCastleInfo: скорректированные координаты:', heroX, heroY);
            console.log('[DEBUG] getCastleInfo: userId:', this.userId);
            
            const requestBody = {
                action: 'check_castle',
                userId: this.userId,
                heroX: heroX,
                heroY: heroY
            };
            
            console.log('[DEBUG] getCastleInfo: отправляем запрос:', requestBody);
            
            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            console.log('[DEBUG] getCastleInfo: получен ответ:', data);
            
            if (data.success && data.castleInfo) {
                console.log('[DEBUG] getCastleInfo: возвращаем castleInfo:', data.castleInfo);
                return data.castleInfo;
            }
            console.log('[DEBUG] getCastleInfo: castleInfo не найден, возвращаем null');
            return null;
        } catch (error) {
            console.error('Ошибка при получении информации о замке:', error);
            return null;
        }
    }

    // Захват замка
    async captureCastle() {
        // Проверяем, что это замок чертей
        const castleX = this.heroX - this.HERO_X_OFFSET;
        const castleY = this.heroY - this.HERO_Y_OFFSET;
        const castleType = this.getCastleType(castleX, castleY);
        
        console.log('[DEBUG] captureCastle: тип замка:', castleType);
        
        if (castleType === 'enemy') {
            // Сначала проверяем, не принадлежит ли замок уже игроку
            try {
                const castleInfo = await this.getCastleInfo();
                console.log('[DEBUG] captureCastle: информация о замке:', castleInfo);
                
                if (castleInfo && castleInfo.ownerId === parseInt(this.userId)) {
                    console.log('[DEBUG] captureCastle: замок уже принадлежит игроку, показываем окно замка');
                    // Замок уже принадлежит игроку - показываем окно замка с сообщением о победе
                    this.enemyCastleJustCaptured = true;
                    this.showCastleWindow();
                    return;
                }
            } catch (error) {
                console.error('[DEBUG] captureCastle: ошибка при получении информации о замке:', error);
            }
            
            // Замок не принадлежит игроку - открываем модальное окно с составом армий
            console.log('[DEBUG] captureCastle: замок не принадлежит игроку, открываем бой');
            this.showBattlePreparationWindow();
            return;
        }
        try {
            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'capture_castle',
                    userId: this.userId,
                    castleX: this.heroX - this.HERO_X_OFFSET,
                    castleY: this.heroY - this.HERO_Y_OFFSET
                })
            });

            const data = await response.json();
            if (data.success) {
                await Swal.fire({
                    title: 'Успех!',
                    text: data.message,
                    icon: 'success',
                    confirmButtonText: 'OK'
                });
                // Закрываем текущее окно и открываем новое с обновленной информацией
                this.closeCastleWindow();
                this.showCastleWindow();
            } else {
                await Swal.fire({
                    title: 'Ошибка',
                    text: data.message,
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
        } catch (error) {
            console.error('Ошибка при захвате замка:', error);
            await Swal.fire({
                title: 'Ошибка',
                text: 'Произошла ошибка при захвате замка',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    }

    async loadUserArmy() {
        try {
            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_user_army',
                    userId: this.userId
                })
            });

            const data = await response.json();

            if (data.success) {
                this.userArmy = data.army || [];
                console.log("Армия загружена:", this.userArmy);
            } else {
                console.warn("Не удалось загрузить армию:", data.message);
                this.userArmy = [];
            }
        } catch (error) {
            console.error("Ошибка при загрузке армии:", error);
            this.userArmy = [];
        }
    }

    // Отзыв владения замком
    async relinquishCastle() {
        try {
            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'relinquish_castle',
                    userId: this.userId,
                    castleX: this.heroX - this.HERO_X_OFFSET,
                    castleY: this.heroY - this.HERO_Y_OFFSET
                })
            });

            const data = await response.json();
            if (data.success) {
                await Swal.fire({
                    title: 'Успех!',
                    text: data.message,
                    icon: 'success',
                    confirmButtonText: 'OK'
                });
                // Закрываем текущее окно и открываем новое с обновленной информацией
                this.closeCastleWindow();
                this.showCastleWindow();
            } else {
                await Swal.fire({
                    title: 'Ошибка',
                    text: data.message,
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
        } catch (error) {
            console.error('Ошибка при отзыве владения замком:', error);
            await Swal.fire({
                title: 'Ошибка',
                text: 'Произошла ошибка при отзыве владения замком',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    }

    // Закрытие окна замка
    closeCastleWindow() {
        playGameMusic && playGameMusic('grass');
        const modal = document.querySelector('.castle-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Метод для переключения полноэкранного режима
    toggleFullScreen() {
        const elem = document.documentElement;

        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => {
                console.error(`Ошибка при попытке перейти в полноэкранный режим: ${err.message}`);
            });
            document.getElementById('fullscreenBtn').textContent = 'Выйти из полноэкрана';
        } else {
            document.exitFullscreen();
            document.getElementById('fullscreenBtn').textContent = 'На весь экран';
        }

        // Перерисовываем карту после изменения размера экрана
        setTimeout(() => {
            this.drawMap();
        }, 100);
    }

    // Метод для обработки изменения размера окна
    handleResize() {
        console.log("Window resized");
        // Перерисовываем карту с небольшой задержкой для того,
        // чтобы все DOM-элементы обновились
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            this.drawMap();
        }, 200);
    }

    // Функция для получения типа местности по координатам
    getTerrainType(x, y) {
        if (!this.mapData) return null;

        const mapLines = this.mapData.split('\n');
        if (y < 0 || y >= mapLines.length) return null;

        const line = mapLines[y];
        if (x < 0 || x >= line.length) return null;

        return line[x];
    }

    // Обработчик наведения мыши на тайл
    handleTileHover(event) {
        const tile = event.target;
        const x = parseInt(tile.dataset.x);
        const y = parseInt(tile.dataset.y);
        const terrain = tile.dataset.terrain;

        // Корректируем координаты героя для сравнения
        const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
        const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;

        // Проверяем, соседний ли тайл к герою (для перемещения)
        let canMove = false;
        const dx = Math.abs(x - correctedHeroX);
        const dy = Math.abs(y - correctedHeroY);

        // Проверяем, что клетка находится в пределах 1 клетки по горизонтали и вертикали
        if (dx <= 1 && dy <= 1 && (dx > 0 || dy > 0)) {
            if (this.isPassableTerrain(terrain)) {
                canMove = true;
            }
        }

        // Обновляем информацию о блоке
        document.getElementById('hoverCoords').textContent = `Координаты: X=${x}, Y=${y}`;
        document.getElementById('hoverTerrain').textContent =
            `Местность: ${this.terrainTypes[terrain] || 'Неизвестно'}` +
            (canMove ? ' (Можно переместиться)' : '');
    }

    // Обработчик ухода мыши с тайла
    handleTileHoverEnd(event) {
        // Сбрасываем информацию о блоке
        document.getElementById('hoverCoords').textContent = 'Наведите на блок';
        document.getElementById('hoverTerrain').textContent = '';
    }

    // Добавляем метод для подсветки непроходимой клетки
    highlightImpassableTile(tile, x, y) {
        if (!tile) return;

        console.log('Подсвечиваем непроходимую клетку:', x, y);

        // Добавляем класс подсветки
        tile.classList.add('impassable-tile');

        // Убираем подсветку через 1.5 секунды
        setTimeout(() => {
            tile.classList.remove('impassable-tile');
        }, 1500);

        // Показываем сообщение пользователю
        Swal.fire({
            title: 'Непроходимая местность',
            text: 'Герой не может переместиться на этот тип местности',
            icon: 'warning',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1500
        });
    }

    // Добавляем новый метод для расчета общей стоимости пути в шагах
    calculatePathCost(path) {
        if (!path || path.length === 0) return 0;

        let totalCost = 0;

        // Проходим по каждой точке пути и суммируем стоимость перемещения
        for (const point of path) {
            const terrain = this.getTerrainType(point.x, point.y);
            let moveCost = 0.5; // По умолчанию

            // Определяем стоимость перемещения для каждого типа местности
            switch (terrain) {
                case 'G':
                    moveCost = 0.5;
                    break; // Трава стоит 0.5 шага
                case 'F':
                    moveCost = 1.0;
                    break; // Лес стоит 1.0 шага
                case 'D':
                    moveCost = 1.0;
                    break; // Пустыня стоит 1.0 шага
                case 'B':
                    moveCost = 0.5;
                    break; // Мост стоит 0.5 шага
                case 'E':
                    moveCost = 0.5;
                    break; // Вход в замок стоит 0.5 шага
            }

            totalCost += moveCost;
        }

        return totalCost;
    }

    // Метод для проверки, находится ли тайл в тумане войны
    isTileInFogOfWar(x, y) {
        // Получаем корректированную позицию героя
        const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
        const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;

        // Вычисляем расстояние от героя до клетки (манхэттенское расстояние)
        const distance = Math.abs(x - correctedHeroX) + Math.abs(y - correctedHeroY);

        // Клетка в тумане войны, если она не исследована и не находится в радиусе видимости
        return !this.isTileExplored(x, y) && distance > this.fogOfWarRadius;
    }

    // Обработчик клика по тайлу
    handleTileClick(event) {
        // Получаем тайл и его свойства
        const tile = event.target;
        const x = parseInt(tile.dataset.x);
        const y = parseInt(tile.dataset.y);
        const terrain = tile.dataset.terrain;

        console.log('Клик по тайлу:', x, y, 'с типом местности:', terrain);

        // Проверяем, находится ли тайл в тумане войны
        if (this.isTileInFogOfWar(x, y)) {
            console.log('Невозможно переместиться на неисследованную территорию');

            // Показываем уведомление пользователю
            Swal.fire({
                title: 'Неизведанная территория',
                text: 'Вы не можете перемещаться в туман войны. Исследуйте соседние области сначала.',
                icon: 'warning',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });

            return;
        }

        // Проверяем, можно ли перемещаться на этот тип местности
        if (!this.isPassableTerrain(terrain)) {
            console.log('Невозможно переместиться на непроходимую местность:', terrain);
            // Подсвечиваем непроходимую клетку красным
            this.highlightImpassableTile(tile, x, y);
            return;
        }

        // Корректируем координаты героя для сравнения
        const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
        const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;

        console.log('Скорректированные координаты героя:', correctedHeroX, correctedHeroY);

        // Вычисляем расстояние
        const dx = Math.abs(x - correctedHeroX);
        const dy = Math.abs(y - correctedHeroY);

        console.log('Дистанция до клетки:', dx, dy);

        // Проверяем, что клетка находится в пределах 1 клетки по горизонтали, вертикали или диагонали
        // и что это не та же самая клетка, на которой стоит герой
        if (dx <= 1 && dy <= 1 && (dx > 0 || dy > 0)) {
            console.log('Перемещаем героя на соседнюю клетку с учетом смещения:', x + this.HERO_X_OFFSET, y + this.HERO_Y_OFFSET);

            // Добавляем смещение обратно к координатам из тайла, чтобы получить реальные координаты для сервера
            this.moveHero(x + this.HERO_X_OFFSET, y + this.HERO_Y_OFFSET);
        } else {
            console.log('Клетка не соседняя - пробуем найти путь до нее');

            // Проверяем, кликнули ли мы по тому же тайлу второй раз
            const tileKey = `${x},${y}`;
            const isSecondClick = this.lastClickedTile === tileKey && this.pendingPath;

            if (isSecondClick) {
                console.log('Второй клик по тому же тайлу - начинаем движение');

                // Сохраняем копию пути перед отменой текущего пути, иначе мы потеряем информацию о пути
                const pathCopy = [...this.pendingPath];

                // Очищаем переменные для повторного использования
                this.pendingPath = null;
                this.lastClickedTile = null;

                // Очищаем визуализацию пути
                this.clearPathVisualization();

                // Начинаем следовать по пути
                this.followPath(pathCopy);
            } else {
                // Отменяем любой текущий путь
                this.cancelPath();

                // Находим путь от героя до целевой клетки
                const path = this.findPath(correctedHeroX, correctedHeroY, x, y);

                if (path.length > 0) {
                    console.log('Найден путь длиной', path.length, ':', path);

                    // Вычисляем стоимость всего пути в шагах
                    const pathCost = this.calculatePathCost(path);
                    console.log('Стоимость всего пути:', pathCost, 'шагов');

                    // Проверяем, хватит ли шагов на этот путь
                    if (pathCost > this.remainingSteps) {
                        console.log('Недостаточно шагов для прохождения пути. Нужно:', pathCost, 'доступно:', this.remainingSteps);

                        // Показываем сообщение о невозможности пройти весь путь
                        Swal.fire({
                            title: 'Недостаточно шагов',
                            text: `Для прохождения всего маршрута нужно ${pathCost.toFixed(1)} шагов, у вас осталось ${this.remainingSteps.toFixed(1)} шагов.`,
                            icon: 'warning',
                            confirmButtonText: 'ОК'
                        });
                        return;
                    }

                    // Подсвечиваем путь
                    this.visualizePath(path);

                    // Сохраняем путь и тайл для второго клика
                    this.pendingPath = path;
                    this.lastClickedTile = tileKey;

                    // Показываем подсказку пользователю
                    Swal.fire({
                        title: 'Маршрут построен',
                        text: 'Нажмите на эту клетку еще раз, чтобы начать движение.',
                        icon: 'info',
                        toast: true,
                        position: 'top-start',

                        showConfirmButton: false,
                        timer: 4000
                    });
                } else {
                    console.log('Путь не найден');

                    // Очищаем переменные
                    this.lastClickedTile = null;

                    // Уведомляем пользователя
                    Swal.fire({
                        title: 'Путь не найден',
                        text: 'Невозможно добраться до этой точки',
                        icon: 'warning',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            }
        }
    }

    // Обработчик касания тайла (для мобильных устройств)
    handleTileTouch(event) {
        // Предотвращаем прокрутку страницы при касании тайла
        event.preventDefault();

        // Получаем тайл и его свойства
        const tile = event.target;
        const x = parseInt(tile.dataset.x);
        const y = parseInt(tile.dataset.y);
        const terrain = tile.dataset.terrain;

        console.log('Касание тайла:', x, y, 'с типом местности:', terrain);

        // Проверяем на двойное касание для отмены пути
        const now = Date.now();
        if (this.isFollowingPath && this.lastTouchedTile === tile && (now - this.lastTouchTime) < 300) {
            console.log('Обнаружено двойное касание - отмена пути');
            this.cancelPath();

            // Сбрасываем флаги касания
            this.lastTouchedTile = null;
            this.lastTouchTime = 0;
            return;
        }

        // Проверяем, находится ли тайл в тумане войны
        if (this.isTileInFogOfWar(x, y)) {
            console.log('Невозможно переместиться на неисследованную территорию');

            // Показываем уведомление пользователю
            Swal.fire({
                title: 'Неизведанная территория',
                text: 'Вы не можете перемещаться в туман войны. Исследуйте соседние области сначала.',
                icon: 'warning',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });

            return;
        }

        // Запоминаем последний тайл и время касания
        this.lastTouchedTile = tile;
        this.lastTouchTime = now;

        // Проверяем, можно ли перемещаться на этот тип местности
        if (!this.isPassableTerrain(terrain)) {
            console.log('Невозможно переместиться на непроходимую местность:', terrain);
            // Подсвечиваем непроходимую клетку красным
            this.highlightImpassableTile(tile, x, y);
            return;
        }

        // Корректируем координаты героя для сравнения
        const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
        const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;

        console.log('Скорректированные координаты героя:', correctedHeroX, correctedHeroY);

        // Вычисляем расстояние
        const dx = Math.abs(x - correctedHeroX);
        const dy = Math.abs(y - correctedHeroY);

        console.log('Дистанция до клетки:', dx, dy);

        // Проверяем, что клетка находится в пределах 1 клетки по горизонтали и вертикали
        // и что это не та же самая клетка, на которой стоит герой
        if (dx <= 1 && dy <= 1 && (dx > 0 || dy > 0)) {
            console.log('Перемещаем героя на координаты с учетом смещения:', x + this.HERO_X_OFFSET, y + this.HERO_Y_OFFSET);

            // Добавляем смещение обратно к координатам из тайла, чтобы получить реальные координаты для сервера
            this.moveHero(x + this.HERO_X_OFFSET, y + this.HERO_Y_OFFSET);
        } else {
            console.log('Клетка не соседняя - пробуем найти путь до нее');

            // Проверяем, кликнули ли мы по тому же тайлу второй раз
            const tileKey = `${x},${y}`;
            const isSecondTouch = this.lastClickedTile === tileKey && this.pendingPath;

            if (isSecondTouch) {
                console.log('Второе касание по тому же тайлу - начинаем движение');

                // Сохраняем копию пути перед отменой текущего пути, иначе мы потеряем информацию о пути
                const pathCopy = [...this.pendingPath];

                // Очищаем переменные для повторного использования
                this.pendingPath = null;
                this.lastClickedTile = null;

                // Очищаем визуализацию пути
                this.clearPathVisualization();

                // Начинаем следовать по пути
                this.followPath(pathCopy);
            } else {
                // Отменяем любой текущий путь
                this.cancelPath();

                // Находим путь от героя до целевой клетки
                const path = this.findPath(correctedHeroX, correctedHeroY, x, y);

                if (path.length > 0) {
                    console.log('Найден путь длиной', path.length, ':', path);

                    // Вычисляем стоимость всего пути в шагах
                    const pathCost = this.calculatePathCost(path);
                    console.log('Стоимость всего пути:', pathCost, 'шагов');

                    // Проверяем, хватит ли шагов на этот путь
                    if (pathCost > this.remainingSteps) {
                        console.log('Недостаточно шагов для прохождения пути. Нужно:', pathCost, 'доступно:', this.remainingSteps);

                        // Показываем сообщение о невозможности пройти весь путь
                        Swal.fire({
                            title: 'Недостаточно шагов',
                            text: `Для прохождения всего маршрута нужно ${pathCost.toFixed(1)} шагов, у вас осталось ${this.remainingSteps.toFixed(1)} шагов.`,
                            icon: 'warning',
                            confirmButtonText: 'ОК'
                        });
                        return;
                    }

                    // Подсвечиваем путь
                    this.visualizePath(path);

                    // Сохраняем путь и тайл для второго клика
                    this.pendingPath = path;
                    this.lastClickedTile = tileKey;

                    // Показываем подсказку пользователю
                    Swal.fire({
                        title: 'Маршрут построен',
                        text: 'Нажмите на эту же клетку еще раз, чтобы начать движение',
                        icon: 'info',
                        toast: true,
                        position: 'top-start',
                        showConfirmButton: false,
                        timer: 3000
                    });
                } else {
                    console.log('Путь не найден');

                    // Очищаем переменные
                    this.lastClickedTile = null;

                    // Уведомляем пользователя
                    Swal.fire({
                        title: 'Путь не найден',
                        text: 'Невозможно добраться до этой точки',
                        icon: 'warning',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            }
        }
    }

    // Визуализация пути
    visualizePath(path) {
        if (!path || path.length === 0) return;

        console.log("Визуализация пути, количество точек:", path.length);

        if (path.length > 100) {
            console.error('Слишком длинный путь, ограничиваем до 100 точек');
            path = path.slice(0, 100);
        }

        this.clearPathVisualization();
        this.originalTileClasses = {};

        const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
        const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;
        const targetPoint = path[path.length - 1];

        // Подсвечиваем первый шаг из маршрута
        this.colorAdjacentTiles(correctedHeroX, correctedHeroY, targetPoint, path);

        // Отмечаем все остальные тайлы на пути, пропуская клетку героя и первый шаг
        path.forEach((point, index) => {
            if (typeof point.x !== 'number' || typeof point.y !== 'number') {
                console.error('Неверные координаты точки пути:', point);
                return;
            }
            if (point.x === correctedHeroX && point.y === correctedHeroY) {
                return;
            }
            if (index === 0) return; // Пропускаем первый шаг, он уже подсвечен

            const selector = `.tile[data-x="${point.x}"][data-y="${point.y}"]`;
            const tile = document.querySelector(selector);

            if (!tile) {
                console.warn(`Тайл с координатами x=${point.x}, y=${point.y} не найден!`);
                return;
            }

            const tileKey = `${point.x},${point.y}`;
            this.originalTileClasses[tileKey] = {
                className: tile.className,
                backgroundImage: tile.style.backgroundImage,
                backgroundColor: tile.style.backgroundColor
            };

            const isTarget = index === path.length - 1;
            if (isTarget) {
                tile.style.backgroundColor = '#00ff00';
                tile.style.backgroundImage = 'none';
                tile.style.border = '2px solid #ffff00';
                tile.className = 'tile target-tile';
            } else {
                tile.style.backgroundColor = '#00ff00';
                tile.style.backgroundImage = 'none';
                tile.style.border = '1px solid #008800';
                tile.className = 'tile path-tile';
            }
        });
    }

    // Окрашивание соседних клеток героя, ведущих к цели
    colorAdjacentTiles(heroX, heroY, targetPoint, path) {
        if (!targetPoint || !path || path.length === 0) return;

        // Первый шаг из маршрута
        const firstStep = path[0];
        if (!firstStep) return;

        // Находим тайл
        const selector = `.tile[data-x="${firstStep.x}"][data-y="${firstStep.y}"]`;
        const tile = document.querySelector(selector);

        if (!tile) {
            console.warn(`Тайл первого шага (${firstStep.x}, ${firstStep.y}) не найден!`);
            return;
        }

        // Сохраняем оригинальные данные тайла
        const tileKey = `${firstStep.x},${firstStep.y}`;
        this.originalTileClasses[tileKey] = {
            className: tile.className,
            backgroundImage: tile.style.backgroundImage,
            backgroundColor: tile.style.backgroundColor
        };

        // Окрашиваем в яркий зеленый цвет
        tile.style.backgroundColor = '#00ee00';
        tile.style.backgroundImage = 'none';
        tile.style.border = '2px solid #006600';
        tile.className = 'tile path-tile';
        tile.setAttribute('data-adjacent', 'true');
    }

    // Очистка визуализации пути и восстановление оригинальных текстур
    clearPathVisualization() {
        // Восстанавливаем оригинальные данные для тайлов на пути
        if (this.originalTileClasses) {
            Object.keys(this.originalTileClasses).forEach(key => {
                if (!key.includes(',')) return; // Защита от неверных ключей

                const [x, y] = key.split(',').map(Number);
                if (isNaN(x) || isNaN(y)) return; // Защита от неверных координат

                // Находим тайл
                const tile = document.querySelector(`.tile[data-x="${x}"][data-y="${y}"]`);
                if (tile) {
                    const originalData = this.originalTileClasses[key];

                    // Восстанавливаем оригинальные стили и классы
                    if (originalData) {
                        tile.className = originalData.className || 'tile';

                        if (originalData.backgroundImage) {
                            tile.style.backgroundImage = originalData.backgroundImage;
                        } else {
                            tile.style.backgroundImage = '';
                        }

                        if (originalData.backgroundColor) {
                            tile.style.backgroundColor = originalData.backgroundColor;
                        } else {
                            tile.style.backgroundColor = '';
                        }

                        tile.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                        tile.removeAttribute('data-adjacent');
                        tile.style.animation = 'none';
                    }
                }
            });
        }

        // Очищаем хранилище оригинальных классов
        this.originalTileClasses = {};

        // Очищаем все тайлы с data-adjacent (на всякий случай)
        document.querySelectorAll('.tile[data-adjacent]').forEach(tile => {
            tile.className = 'tile';
            tile.style.backgroundColor = '';
            tile.style.backgroundImage = '';
            tile.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            tile.style.animation = 'none';
            tile.style.boxShadow = 'none';
            tile.removeAttribute('data-adjacent');
        });

        // Дополнительно находим и очищаем все тайлы с классами path-tile и target-tile
        document.querySelectorAll('.path-tile, .target-tile').forEach(tile => {
            tile.classList.remove('path-tile', 'target-tile');
            tile.style.backgroundColor = '';
            tile.style.backgroundImage = '';
            tile.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            tile.style.animation = 'none';
            tile.style.boxShadow = 'none';
            tile.removeAttribute('data-adjacent');
        });
    }

    // Отмена текущего пути
    cancelPath() {
        if (this.isFollowingPath) {
            console.log('Отмена пути');
            this.isFollowingPath = false;
            this.currentPath = [];
            this.clearPathVisualization();
        }

        // Очищаем переменную для предварительного пути
        this.pendingPath = null;
        this.lastClickedTile = null;
    }

    // Обработка нажатий клавиш
    handleKeyDown(event) {
        // Обработка клавиши Escape для отмены текущего пути
        if (event.key === 'Escape') {
            if (this.isFollowingPath || this.pendingPath) {
                console.log('Отмена пути по нажатию Escape');
                this.cancelPath();

                // Показываем уведомление
                Swal.fire({
                    title: 'Путь отменен',
                    text: 'Движение по пути прервано',
                    icon: 'info',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 1500
                });
            }

            // Закрытие окна замка при нажатии ESC
            const castleModal = document.querySelector('.castle-modal');
            if (castleModal) {
                this.closeCastleWindow();
            }
        }
    }

    // Определяем тип местности под героем и обновляем информационную панель
    updateHeroInfo() {
        // Корректируем смещение героя на -1 по X и -1 по Y для определения типа местности
        const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
        const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;

        // Получаем тип местности с учетом коррекции
        const heroTerrainType = this.getTerrainType(correctedHeroX, correctedHeroY);

        // Обновляем информацию о герое в панели
        const heroInfo = document.querySelector('.hero-info');
        if (heroInfo) {
            heroInfo.innerHTML = `
                <h3>Информация о герое</h3>
                <p>Позиция: X=${correctedHeroX}, Y=${correctedHeroY}</p>
                <p>Местность: ${this.terrainTypes[heroTerrainType] || 'Неизвестно'}</p>
            `;
        }
    }

    // Проверяем, можно ли ходить по данному типу местности
    isPassableTerrain(terrainType) {
        // Определяем проходимые типы местности
        const passableTerrains = ['G', 'F', 'D', 'B', 'E', 'T', 'N', 'Y']; // добавил 'Y' — дверь вражеского замка
        return passableTerrains.includes(terrainType);
    }

    // Обработка действия (кнопка E или центральная кнопка)
    async handleAction() {
        const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
        const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;

        // Проверяем, стоит ли герой на входе в замок
        const terrainType = this.getTerrainType(correctedHeroX, correctedHeroY);

        if (terrainType === 'E' || terrainType === 'Y') {
            // Если герой стоит на входе в замок, вызываем взаимодействие
            await this.checkCastleInteraction();
        } else {
            // Проверяем, находится ли герой рядом с замком
            const nearbyTiles = [
                { x: correctedHeroX + 1, y: correctedHeroY },
                { x: correctedHeroX - 1, y: correctedHeroY },
                { x: correctedHeroX, y: correctedHeroY + 1 },
                { x: correctedHeroX, y: correctedHeroY - 1 }
            ];

            let nearCastle = false;
            for (const tile of nearbyTiles) {
                const tileType = this.getTerrainType(tile.x, tile.y);
                if (tileType === 'C' || tileType === 'E' || tileType === 'X' || tileType === 'Y') {
                    nearCastle = true;
                    break;
                }
            }

            if (nearCastle) {
                await this.checkCastleInteraction();
            } else {
                await Swal.fire({
                    title: 'Внимание',
                    text: 'Нет объектов, с которыми можно взаимодействовать. Подойдите к замку.',
                    icon: 'info',
                    confirmButtonText: 'OK'
                });
            }
        }
    }

    // Метод для обновления информации о дне и шагах в интерфейсе
    updateDayAndStepsInfo() {
        console.log('Обновление UI - текущие значения:', {
            day: this.currentDay,
            steps: this.remainingSteps
        });

        // Создаем или обновляем элемент с информацией о дне и шагах
        let dayInfoElement = document.getElementById('dayInfo');

        if (!dayInfoElement) {
            console.log('Создание нового элемента dayInfo');
            // Если элемент не существует, создаем его
            dayInfoElement = document.createElement('div');
            dayInfoElement.id = 'dayInfo';
            dayInfoElement.className = 'day-info';

            // Добавляем элемент в header
            const gameHeader = document.querySelector('.game-header');
            if (gameHeader) {
                gameHeader.appendChild(dayInfoElement);
            } else {
                console.error('Не найден элемент .game-header');
                return;
            }
        }

        // Добавляем специальное оформление, если шаги закончились
        let stepsClass = '';
        let stepsText = `Осталось шагов: ${this.remainingSteps.toFixed(1)}`;

        if (this.remainingSteps <= 0) {
            stepsClass = 'steps-exhausted';
            stepsText = 'Шаги закончились! Нажмите на кнопку';
        }

        // Обновляем содержимое элемента
        const newContent = `
            <div class="day">День: ${this.currentDay}</div>
            <div class="steps ${stepsClass}">${stepsText}</div>
            <button class="end-day-btn" onclick="game.startNewDay()">Завершить день</button>
        `;

        dayInfoElement.innerHTML = newContent;
        console.log('UI обновлен:', newContent);
        console.log('Элемент dayInfo после обновления:', dayInfoElement.innerHTML);
    }

    async startNewDay() {
        try {
            const response = await fetch('/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'start_new_day',
                    userId: this.userId
                })
            });

            const data = await response.json();

            if (data.success) {
                // Сохраняем старые значения ресурсов
                const oldResources = {...this.resources };

                // Обновляем состояние игры
                this.currentDay = data.state.currentDay;
                this.remainingSteps = data.state.remainingSteps;

                // Обновляем ресурсы
                if (data.resources) {
                    this.resources = data.resources;
                }

                // Вычисляем разницу в ресурсах
                const resourceChanges = {
                    wood: this.resources.wood - oldResources.wood,
                    ore: this.resources.ore - oldResources.ore,
                    gold: this.resources.gold - oldResources.gold
                };

                // Формируем сообщение о добавленных ресурсах
                let resourceMessage = '';
                const changes = [];

                if (resourceChanges.wood > 0) {
                    changes.push(`${resourceChanges.wood} дерева`);
                }
                if (resourceChanges.ore > 0) {
                    changes.push(`${resourceChanges.ore} руды`);
                }
                if (resourceChanges.gold > 0) {
                    changes.push(`${resourceChanges.gold} золота`);
                }

                if (changes.length > 0) {
                    resourceMessage = `Добавлено: ${changes.join(', ')}`;
                } else {
                    resourceMessage = 'Нет новых ресурсов';
                }

                // Показываем уведомление
                Swal.fire({
                    title: 'Новый день начался!',
                    html: `
                        <p>День ${this.currentDay}</p>
                        <p>${resourceMessage}</p>
                        <p>Осталось ходов: ${this.remainingSteps}</p>
                    `,
                    icon: 'success',
                    confirmButtonText: 'OK'
                });

                // Обновляем отображение
                this.updateDayAndStepsInfo();
                this.updateResourcesDisplay();
                this.updateHeroInfo();
            } else {
                Swal.fire({
                    title: 'Ошибка',
                    text: data.message || 'Не удалось начать новый день',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
        } catch (error) {
            console.error('Ошибка при начале нового дня:', error);
            Swal.fire({
                title: 'Ошибка',
                text: 'Произошла ошибка при начале нового дня',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    }

    // Метод для добавления ресурсов от захваченных зданий
    addResourcesFromBuildings() {
        // Добавляем ресурсы от лесопилок
        this.capturedBuildings.sawmills.forEach(sawmill => {
            this.resources.wood += sawmill.production;
        });

        // Добавляем ресурсы от шахт
        this.capturedBuildings.mines.forEach(mine => {
            this.resources.ore += mine.oreProduction;
            this.resources.gold += mine.goldProduction;
        });

        // Обновляем отображение
        this.updateResourcesDisplay();
    }

    // Алгоритм поиска пути (A*)
    findPath(startX, startY, targetX, targetY) {
        // Проверяем, что точки находятся в пределах карты
        if (!this.mapData) return [];

        const mapLines = this.mapData.split('\n');
        const maxY = mapLines.length;
        const maxX = mapLines[0] ? mapLines[0].length : 0;

        if (targetX < 0 || targetY < 0 || targetX >= maxX || targetY >= maxY) {
            console.error('Целевая точка вне карты');
            return [];
        }

        // Проверяем, что целевая точка проходима (Y — проходима)
        const targetTerrain = this.getTerrainType(targetX, targetY);
        if (!this.isPassableTerrain(targetTerrain)) {
            // Но если целевая точка — Y (дверь замка чертей), разрешаем
            if (targetTerrain !== 'Y') {
                console.error('Целевая точка непроходима');
                return [];
            }
        }

        // Проверяем, что целевая точка не находится в тумане войны
        if (!this.isTileExplored(targetX, targetY) &&
            (Math.abs(targetX - startX) + Math.abs(targetY - startY) > this.fogOfWarRadius)) {
            console.error('Целевая точка находится в тумане войны');
            return [];
        }

        // Пробуем построить быстрый оптимальный путь без препятствий
        const fastPath = this.buildOptimalPathWithObstacles(startX, startY, targetX, targetY);
        if (fastPath.length > 0) return fastPath;

        // Начальные структуры для алгоритма A*
        const openSet = [];
        const closedSet = new Set();
        const gScore = new Map(); // стоимость пути от начала до текущей точки
        const fScore = new Map(); // оценка полного пути через текущую точку
        const cameFrom = new Map(); // для восстановления пути

        // Функция для получения ключа координат
        const getKey = (x, y) => `${x},${y}`;

        // Функция эвристики (диагональное расстояние)
        const heuristic = (x1, y1, x2, y2) => Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));

        // Получение стоимости перемещения по типу местности
        const getTerrainCost = (terrain) => {
            switch (terrain) {
                case 'G':
                    return 0.5; // Трава
                case 'F':
                    return 1.0; // Лес
                case 'D':
                    return 1.0; // Пустыня
                case 'B':
                    return 0.5; // Мост
                case 'E':
                    return 0.5; // Вход в замок
                case 'T':
                    return 0.5; // Вход в лесопилку
                case 'N':
                    return 0.5; // Вход в шахту
                case 'Y':
                    return 0.5; // Вход в замок чертей
                default:
                    return null; // Непроходимая местность
            }
        };

        // Функция для получения соседей
        const getNeighbors = (x, y) => {
            const neighbors = [];
            // Сначала прямые направления, потом диагонали
            const directions = [
                { dx: 0, dy: -1 }, // вверх
                { dx: 1, dy: 0 }, // вправо
                { dx: 0, dy: 1 }, // вниз
                { dx: -1, dy: 0 }, // влево
                { dx: 1, dy: 1 }, // вниз-вправо
                { dx: 1, dy: -1 }, // вверх-вправо
                { dx: -1, dy: 1 }, // вниз-влево
                { dx: -1, dy: -1 } // вверх-влево
            ];

            for (const dir of directions) {
                const nx = x + dir.dx;
                const ny = y + dir.dy;

                // Проверяем границы
                if (nx < 0 || ny < 0 || nx >= maxX || ny >= maxY) continue;

                // Проверяем проходимость
                const terrain = this.getTerrainType(nx, ny);
                // Y — проходима, X — нет
                if (!this.isPassableTerrain(terrain) && terrain !== 'Y') continue;

                // Проверяем туман войны
                if (!this.isTileExplored(nx, ny) &&
                    Math.abs(nx - startX) + Math.abs(ny - startY) > this.fogOfWarRadius) {
                    continue;
                }

                // Для диагонального движения проверяем соседние клетки
                if (dir.dx !== 0 && dir.dy !== 0) {
                    const terrain1 = this.getTerrainType(x + dir.dx, y);
                    const terrain2 = this.getTerrainType(x, y + dir.dy);
                    if ((!this.isPassableTerrain(terrain1) && terrain1 !== 'Y') || (!this.isPassableTerrain(terrain2) && terrain2 !== 'Y')) {
                        continue;
                    }
                }

                neighbors.push({ x: nx, y: ny, terrain });
            }

            return neighbors;
        };

        // Инициализация для стартовой точки
        const startKey = getKey(startX, startY);
        gScore.set(startKey, 0);
        fScore.set(startKey, heuristic(startX, startY, targetX, targetY));
        openSet.push({ x: startX, y: startY, f: fScore.get(startKey) });

        // Основной цикл A*
        while (openSet.length > 0) {
            // Сортируем по f-оценке и берем лучший узел
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = getKey(current.x, current.y);

            // Если достигли цели
            if (current.x === targetX && current.y === targetY) {
                // Восстанавливаем путь
                const path = [];
                let currentNode = currentKey;

                while (currentNode !== startKey) {
                    const [x, y] = currentNode.split(',').map(Number);
                    path.unshift({ x, y });
                    currentNode = cameFrom.get(currentNode);
                }

                return path;
            }

            // Добавляем в обработанные
            closedSet.add(currentKey);

            // Обработка соседей
            for (const neighbor of getNeighbors(current.x, current.y)) {
                const neighborKey = getKey(neighbor.x, neighbor.y);

                // Пропускаем уже обработанные узлы
                if (closedSet.has(neighborKey)) continue;

                // Получаем стоимость движения
                const moveCost = getTerrainCost(neighbor.terrain);
                if (moveCost === null) continue;

                // Вычисляем новую стоимость пути
                const tentativeGScore = gScore.get(currentKey) + moveCost;

                // Проверяем, нужно ли обновить путь
                if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                    // Обновляем путь
                    cameFrom.set(neighborKey, currentKey);
                    gScore.set(neighborKey, tentativeGScore);
                    fScore.set(neighborKey, tentativeGScore + heuristic(neighbor.x, neighbor.y, targetX, targetY));

                    // Добавляем в открытый набор, если его там еще нет
                    if (!openSet.some(node => node.x === neighbor.x && node.y === neighbor.y)) {
                        openSet.push({
                            x: neighbor.x,
                            y: neighbor.y,
                            f: fScore.get(neighborKey)
                        });
                    }
                }
            }
        }

        console.error('Путь не найден');
        return [];
    }

    // Следование по пути
    async followPath(path) {
        if (!path || path.length === 0) {
            console.log('Пустой путь для следования');
            return;
        }

        this.isFollowingPath = true;
        this.currentPath = [...path]; // Копируем путь

        console.log('Начинаем следовать по пути длиной', this.currentPath.length);

        // Начинаем движение по пути
        await this.moveNextStep();
    }

    // Метод для перемещения на следующий шаг пути
    async moveNextStep() {
        if (!this.isFollowingPath || this.currentPath.length === 0) {
            console.log('Путь закончился или отменен');
            this.isFollowingPath = false;
            return;
        }

        if (this.isMoving) {
            console.log('Уже в процессе перемещения, ожидаем...');
            setTimeout(() => this.moveNextStep(), 100);
            return;
        }

        // Берем следующую точку пути
        const nextPoint = this.currentPath.shift();
        console.log('Следующий шаг:', nextPoint);

        // Проверяем, хватит ли шагов для следующего хода
        const terrainType = this.getTerrainType(nextPoint.x, nextPoint.y);
        let moveCost = 0.5; // По умолчанию

        // Определяем стоимость перемещения
        switch (terrainType) {
            case 'G':
                moveCost = 0.5;
                break; // Трава стоит 0.5 шага
            case 'F':
                moveCost = 1.0;
                break; // Лес стоит 1.0 шага
            case 'D':
                moveCost = 1.0;
                break; // Пустыня стоит 1.0 шага
            case 'B':
                moveCost = 0.5;
                break; // Мост стоит 0.5 шага
            case 'E':
                moveCost = 0.5;
                break; // Вход в замок стоит 0.5 шага
        }

        if (this.remainingSteps < moveCost) {
            console.log('Недостаточно шагов для продолжения пути');
            this.isFollowingPath = false;
            this.clearPathVisualization();

            // Обновляем интерфейс
            this.updateDayAndStepsInfo();

            // Показываем сообщение пользователю
            await Swal.fire({
                title: 'Шаги закончились',
                text: 'У героя закончились очки движения. Нажмите "Завершить день", чтобы получить новые очки движения.',
                icon: 'info',
                confirmButtonText: 'ОК'
            });

            return;
        }

        // Учитываем смещение героя
        const targetX = nextPoint.x + this.HERO_X_OFFSET;
        const targetY = nextPoint.y + this.HERO_Y_OFFSET;

        // Находим тайл по координатам и восстанавливаем его оригинальный вид
        const tileKey = `${nextPoint.x},${nextPoint.y}`;
        if (this.originalTileClasses[tileKey]) {
            const tile = document.querySelector(`.tile[data-x="${nextPoint.x}"][data-y="${nextPoint.y}"]`);
            if (tile) {
                const originalData = this.originalTileClasses[tileKey];

                // Восстанавливаем класс и стили
                tile.className = originalData.className || 'tile';

                if (originalData.backgroundImage) {
                    tile.style.backgroundImage = originalData.backgroundImage;
                } else {
                    tile.style.backgroundImage = '';
                }

                if (originalData.backgroundColor) {
                    tile.style.backgroundColor = originalData.backgroundColor;
                } else {
                    tile.style.backgroundColor = '';
                }

                tile.style.border = '1px solid rgba(255, 255, 255, 0.1)';

                // Удаляем из хранилища
                delete this.originalTileClasses[tileKey];
            }
        }

        // Выполняем перемещение
        await this.moveHero(targetX, targetY);

        // Если есть еще точки в пути и у нас остались шаги - продолжаем движение
        if (this.currentPath.length > 0 && this.remainingSteps > 0) {
            // Добавляем небольшую задержку перед следующим шагом
            setTimeout(() => {
                this.moveNextStep();
            }, 100);
        } else {
            // Завершаем следование по пути
            this.isFollowingPath = false;
            this.clearPathVisualization();

            // Если шаги закончились, выводим сообщение
            if (this.remainingSteps <= 0) {
                // Обновляем интерфейс
                this.updateDayAndStepsInfo();

                await Swal.fire({
                    title: 'Шаги закончились',
                    text: 'У героя закончились очки движения. Нажмите "Завершить день", чтобы получить новые очки движения.',
                    icon: 'info',
                    confirmButtonText: 'ОК'
                });
            }

            console.log('Путь завершен');
        }
    }

    // Быстрый оптимальный путь с учётом препятствий
    buildOptimalPathWithObstacles(startX, startY, endX, endY) {
        const path = [];
        let x = startX,
            y = startY;
        const dx = endX - startX;
        const dy = endY - startY;
        const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
        const stepY = dy === 0 ? 0 : dy / Math.abs(dy);
        const diagSteps = Math.min(Math.abs(dx), Math.abs(dy));
        const straightSteps = Math.abs(Math.abs(dx) - Math.abs(dy));
        // Диагональные шаги
        for (let i = 0; i < diagSteps; i++) {
            x += stepX;
            y += stepY;
            const terrain = this.getTerrainType(x, y);
            if (!this.isPassableTerrain(terrain)) return [];
            path.push({ x, y });
        }
        // Прямые шаги
        for (let i = 0; i < straightSteps; i++) {
            if (Math.abs(dx) > Math.abs(dy)) x += stepX;
            else y += stepY;
            const terrain = this.getTerrainType(x, y);
            if (!this.isPassableTerrain(terrain)) return [];
            path.push({ x, y });
        }
        return path;
    }

    // Инициализация мини-карты
    initMinimap() {
        // Создаем контейнер для мини-карты
        this.minimapContainer = document.createElement('div');
        this.minimapContainer.className = 'minimap-container';

        // Добавляем метки направлений
        const directions = [
            { cls: 'north', label: 'N' }, // Север
            { cls: 'south', label: 'S' }, // Юг
            { cls: 'west',  label: 'W' }, // Запад
            { cls: 'east',  label: 'E' }  // Восток
        ];
        directions.forEach(dir => {
            const el = document.createElement('div');
            el.className = `minimap-direction-label ${dir.cls}`;
            el.textContent = dir.label;
            this.minimapContainer.appendChild(el);
        });

        // Создаем элемент мини-карты
        this.minimap = document.createElement('div');
        this.minimap.className = 'minimap';

        // Добавляем мини-карту в контейнер
        this.minimapContainer.appendChild(this.minimap);

        // Добавляем контейнер на страницу
        document.body.appendChild(this.minimapContainer);

        // Отрисовываем мини-карту
        this.drawMinimap();
    }

    // Отрисовка мини-карты
    drawMinimap() {
        if (!this.mapData) return;

        // Очищаем мини-карту
        this.minimap.innerHTML = '';

        // Получаем размеры карты
        const mapLines = this.mapData.split('\n');
        const mapWidth = mapLines[0] ? mapLines[0].length : 0;
        const mapHeight = mapLines.length;

        // Вычисляем размер тайла на мини-карте
        const tileSize = Math.min(
            this.minimapContainer.clientWidth / mapWidth,
            this.minimapContainer.clientHeight / mapHeight
        );

        for (let y = 0; y < mapHeight; y++) {
            const line = mapLines[y];
            for (let x = 0; x < mapWidth; x++) {
                const tile = document.createElement('div');
                tile.className = 'minimap-tile';

                // Определяем тип местности
                const terrain = line[x];
                if (this.isTileExplored(x, y)) {
                    switch (terrain) {
                        case 'G':
                            tile.classList.add('minimap-tile-grass');
                            break;
                        case 'F':
                            tile.classList.add('minimap-tile-forest');
                            break;
                        case 'D':
                            tile.classList.add('minimap-tile-desert');
                            break;
                        case 'W':
                            tile.classList.add('minimap-tile-water');
                            break;
                        case 'B':
                            tile.classList.add('minimap-tile-bridge');
                            break;
                        case 'C':
                            tile.classList.add('minimap-tile-castle');
                            break;
                        case 'E':
                            tile.classList.add('minimap-tile-castle-door');
                            break;
                        case 'X':
                            tile.classList.add('minimap-tile-castle-enemy');
                            break;
                        case 'Y':
                            tile.classList.add('minimap-tile-castle-enemy-door');
                            break;
                        case 'S':
                            tile.classList.add('minimap-tile-sawmill');
                            break;
                        case 'T':
                            tile.classList.add('minimap-tile-sawmill-door');
                            break;
                        case 'M':
                            tile.classList.add('minimap-tile-mine');
                            break;
                        case 'N':
                            tile.classList.add('minimap-tile-mine-door');
                            break;
                    }
                } else {
                    tile.classList.add('minimap-tile-fog');
                }

                // Устанавливаем размер и позицию тайла
                tile.style.width = `${tileSize}px`;
                tile.style.height = `${tileSize}px`;
                tile.style.left = `${x * tileSize}px`;
                tile.style.top = `${y * tileSize}px`;

                this.minimap.appendChild(tile);
            }
        }

        // Добавляем маркер героя
        const heroMarker = document.createElement('div');
        heroMarker.className = 'minimap-hero';

        // Корректируем координаты героя
        const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
        const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;

        // Устанавливаем позицию маркера
        heroMarker.style.left = `${correctedHeroX * tileSize}px`;
        heroMarker.style.top = `${correctedHeroY * tileSize}px`;

        this.minimap.appendChild(heroMarker);
    }

    // Отображение окна лесопилки
    showSawmillWindow() {
            playGameMusic && playGameMusic('tower');
            // Удаляем существующее окно, если оно есть
            const existingModal = document.querySelector('.castle-modal');
            if (existingModal) {
                existingModal.remove();
            }

            // Создаем модальное окно
            const modal = document.createElement('div');
            modal.className = 'castle-modal';

            // Создаем окно
            const window = document.createElement('div');
            window.className = 'castle-window';

            // Заголовок окна
            const header = document.createElement('div');
            header.className = 'castle-header';
            header.innerHTML = `
            <h2>Лесопилка</h2>
            <button class="castle-close">&times;</button>
        `;

            // Определяем координаты здания
            const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
            const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;
            const buildingCoords = this.findBuildingCoordinates(correctedHeroX, correctedHeroY, 'S');

            // Находим информацию о захваченной лесопилке
            const sawmill = buildingCoords ? this.capturedBuildings.sawmills.find(
                b => b.x === buildingCoords.x && b.y === buildingCoords.y
            ) : null;

            // Содержимое лесопилки
            const content = document.createElement('div');
            content.className = 'castle-content';

            const currentLevel = sawmill ? sawmill.level : 0;
            const nextLevel = currentLevel + 1;
            const canUpgrade = currentLevel > 0 && currentLevel < 10;

            // Новый расчёт стоимости улучшения по формуле, как на сервере
            const baseProduction = 80;
            const currentProduction = Math.floor(baseProduction * Math.pow(1.5, currentLevel - 1));
            const upgradeCosts = canUpgrade ? {
                wood: Math.floor(currentProduction * 0.45),
                ore: Math.floor(currentProduction * 0.35),
                gold: Math.floor(currentProduction * 0.20)
            } : null;

            content.innerHTML = `
            <div class="castle-section upgrade-section" style="margin-bottom: 10px;">
                <h3 style="margin-bottom: 10px;">Улучшение</h3>
                ${canUpgrade ? `
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                    <span style="font-size: 1.1em;">Уровень:</span>
                    <span style="font-size: 1.3em; font-weight: bold; color: gold;">${currentLevel}</span>
                    <i class="fas fa-arrow-right" style="color: #f1c40f;"></i>
                    <span style="font-size: 1.3em; font-weight: bold; color: #4CAF50;">${nextLevel}</span>
            </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <i class="fas fa-tree" style="color: #4CAF50;"></i>
                    <span>Сейчас: <b>${currentProduction}</b>/день</span>
                    <i class="fas fa-arrow-right" style="color: #f1c40f;"></i>
                    <span>Будет: <b>${nextLevel === 10 ? 'Максимальный уровень' : nextLevel}</b>/день</span>
                </div>
                <div style="margin-bottom: 8px;">
                    <span style="font-size: 1.05em; color: #fff;">Стоимость улучшения:</span>
                    <div style="display: flex; gap: 18px; margin-top: 5px;">
                        <span><i class="fas fa-tree" style="color: #4CAF50;"></i> <b>${upgradeCosts?.wood}</b></span>
                        <span><i class="fas fa-mountain" style="color: #9E9E9E;"></i> <b>${upgradeCosts?.ore}</b></span>
                        <span><i class="fas fa-coins" style="color: #FFD700;"></i> <b>${upgradeCosts?.gold}</b></span>
                    </div>
                </div>
                <button class="castle-btn upgrade-btn" id="sawmill-upgrade-btn-${buildingCoords.x}-${buildingCoords.y}" style="margin-top: 10px;">
                    Улучшить
                </button>
                ` : (currentLevel === 10 ? '<p style="color: #FFD700; font-weight: bold;">Достигнут максимальный уровень</p>' : '<p style="color: #aaa;">Захватите здание, чтобы улучшать его.</p>')}
            </div>
            <div class="castle-section" style="margin-bottom: 0;">
                <h3>Информация</h3>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <span>Уровень:</span>
                    <span style="font-weight: bold; color: gold;">${currentLevel > 0 ? currentLevel : 1}</span>
            </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-tree" style="color: #4CAF50;"></i>
                    <span>Добыча: <b>${currentProduction}</b>/день</span>
                </div>
                ${sawmill ? `<p style="margin-top: 8px;">Владелец: <b>${sawmill.owner}</b></p>` : '<p style="margin-top: 8px;">Владелец: отсутствует</p>'}
            </div>
            ${!sawmill ? `
            <div class="castle-section">
                <button class="castle-btn capture-btn" id="sawmill-capture-btn-${buildingCoords.x}-${buildingCoords.y}">Захватить лесопилку</button>
            </div>
            ` : (sawmill.owner === this.username ? `
            <div class="castle-section">
                <button class="castle-btn relinquish-btn" id="sawmill-relinquish-btn-${buildingCoords.x}-${buildingCoords.y}">Отозвать владение</button>
            </div>
            ` : `
            <div class="castle-section">
                <p>Эта лесопилка уже захвачена игроком ${sawmill.owner}</p>
            </div>
            `)}
        `;

        // Собираем окно
        window.appendChild(header);
        window.appendChild(content);
        modal.appendChild(window);

        // Добавляем окно на страницу
        document.body.appendChild(modal);

        // Добавляем обработчики событий
        const upgradeBtn = document.getElementById(`sawmill-upgrade-btn-${buildingCoords.x}-${buildingCoords.y}`);
        console.log('Кнопка улучшения найдена:', !!upgradeBtn);
        
        if (upgradeBtn && canUpgrade) {
            console.log('Проверка ресурсов для улучшения');
            const hasEnoughResources = this.resources.wood >= upgradeCosts.wood &&
                                     this.resources.ore >= upgradeCosts.ore &&
                                     this.resources.gold >= upgradeCosts.gold;
            console.log('Достаточно ресурсов:', hasEnoughResources);
            console.log('Текущие ресурсы:', this.resources);
            console.log('Требуемые ресурсы:', upgradeCosts);

            if (!hasEnoughResources) {
                upgradeBtn.disabled = true;
                upgradeBtn.textContent = 'Недостаточно ресурсов';
                console.log('Кнопка отключена: недостаточно ресурсов');
            } else {
                console.log('Добавление обработчика на кнопку улучшения');
                upgradeBtn.onclick = async () => {
                    console.log('=== Начало процесса улучшения лесопилки ===');
                    console.log('Нажата кнопка улучшения лесопилки');
                    try {
                        const result = await Swal.fire({
                            title: 'Подтверждение улучшения',
                            html: `Вы уверены, что хотите улучшить лесопилку до уровня ${nextLevel}? <br><br> Это потребует: <br> Дерево: ${upgradeCosts.wood}<br> Руда: ${upgradeCosts.ore}<br> Золото: ${upgradeCosts.gold}`,
                            icon: 'question',
                            showCancelButton: true,
                            confirmButtonText: 'Да, улучшить',
                            cancelButtonText: 'Отмена'
                        });
                        
                        console.log('Результат подтверждения:', result.isConfirmed);
                        
                        if (result.isConfirmed) {
                            console.log('Подтверждено улучшение лесопилки');
                            console.log('Отправка запроса на улучшение...');
                            await this.upgradeBuilding(buildingCoords.x, buildingCoords.y, 'SAWMILL');
                            this.showSawmillWindow();
                        } else {
                            console.log('Улучшение отменено пользователем');
        }
                    } catch (error) {
                        console.error('Ошибка при улучшении лесопилки:', error);
                    }
                };
                console.log('Обработчик успешно добавлен');
            }
        } else {
            console.log('Кнопка улучшения не добавлена:', {
                buttonExists: !!upgradeBtn,
                canUpgrade: canUpgrade
            });
        }

        const captureBtn = document.getElementById(`sawmill-capture-btn-${buildingCoords.x}-${buildingCoords.y}`);
        if (captureBtn) {
            captureBtn.onclick = async () => {
                await this.captureBuilding(correctedHeroX, correctedHeroY);
                this.updateSawmillWindowContent();
            };
        }

        const relinquishBtn = document.getElementById(`sawmill-relinquish-btn-${buildingCoords.x}-${buildingCoords.y}`);
        if (relinquishBtn) {
            relinquishBtn.addEventListener('click', async () => {
                await this.relinquishBuilding(correctedHeroX, correctedHeroY, 'S');
            });
        }

        // Добавляем обработчик для закрытия окна
        const closeBtn = modal.querySelector('.castle-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeCastleWindow();
            });
        }

        const hireArmyBtn = content.querySelector('.hire-army-btn');
        if (hireArmyBtn) {
            hireArmyBtn.addEventListener('click', () => {
                this.showHireArmyMenu();
            });
        }
    }

    // Отображение окна шахты
    showMineWindow() {
        playGameMusic && playGameMusic('tower');
        console.log('Вызвана showMineWindow! Герой:', this.heroX, this.heroY);
        // Удаляем существующее окно, если оно есть
        const existingModal = document.querySelector('.castle-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.className = 'castle-modal';

        // Создаем окно
        const window = document.createElement('div');
        window.className = 'castle-window';

        // Заголовок окна
        const header = document.createElement('div');
        header.className = 'castle-header';
        header.innerHTML = `
            <h2>Шахта</h2>
            <button class="castle-close">&times;</button>
        `;

        // Определяем координаты здания
        const correctedHeroX = this.heroX - this.HERO_X_OFFSET;
        const correctedHeroY = this.heroY - this.HERO_Y_OFFSET;
        const buildingCoords = this.findBuildingCoordinates(correctedHeroX, correctedHeroY, 'M');
        console.log('Попытка открыть окно шахты. Координаты героя:', correctedHeroX, correctedHeroY);
        console.log('Результат поиска координат шахты:', buildingCoords);
        if (!buildingCoords) {
            Swal.fire({
                title: 'Ошибка',
                text: 'Не удалось найти шахту рядом с входом!',
                icon: 'error'
            });
            return;
        }

        // Находим информацию о захваченной шахте
        const mine = this.capturedBuildings.mines.find(
            b => b.x === buildingCoords.x && b.y === buildingCoords.y
        ) || null;

        // Содержимое шахты
        const content = document.createElement('div');
        content.className = 'castle-content';
        
        const currentLevel = mine ? mine.level : 0;
        const nextLevel = currentLevel + 1;
        const canUpgrade = currentLevel > 0 && currentLevel < 10;
        
        const baseOreProduction = 60;
        const baseGoldProduction = 40;
        const currentOreProduction = Math.floor(baseOreProduction * Math.pow(1.5, currentLevel - 1));
        const currentGoldProduction = Math.floor(baseGoldProduction * Math.pow(1.5, currentLevel - 1));
        const nextOreProduction = Math.floor(baseOreProduction * Math.pow(1.5, currentLevel));
        const nextGoldProduction = Math.floor(baseGoldProduction * Math.pow(1.5, currentLevel));
        const upgradeCosts = canUpgrade ? {
            wood: Math.floor(currentOreProduction * 0.45),
            ore: Math.floor(currentOreProduction * 0.35),
            gold: Math.floor(currentOreProduction * 0.20)
        } : null;

        content.innerHTML = `
            <div class="castle-section upgrade-section" style="margin-bottom: 10px;">
                <h3 style="margin-bottom: 10px;">Улучшение</h3>
                ${canUpgrade ? `
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                    <span style="font-size: 1.1em;">Уровень:</span>
                    <span style="font-size: 1.3em; font-weight: bold; color: gold;">${currentLevel}</span>
                    <i class="fas fa-arrow-right" style="color: #f1c40f;"></i>
                    <span style="font-size: 1.3em; font-weight: bold; color: #4CAF50;">${nextLevel}</span>
            </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <i class="fas fa-mountain" style="color: #9E9E9E;"></i>
                    <span>Руда: <b>${currentOreProduction}</b>/день</span>
                    <i class="fas fa-arrow-right" style="color: #f1c40f;"></i>
                    <span>Будет: <b>${nextOreProduction}</b>/день</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <i class="fas fa-coins" style="color: #FFD700;"></i>
                    <span>Золото: <b>${currentGoldProduction}</b>/день</span>
                    <i class="fas fa-arrow-right" style="color: #f1c40f;"></i>
                    <span>Будет: <b>${nextGoldProduction}</b>/день</span>
                </div>
                <div style="margin-bottom: 8px;">
                    <span style="font-size: 1.05em; color: #fff;">Стоимость улучшения:</span>
                    <div style="display: flex; gap: 18px; margin-top: 5px;">
                        <span><i class="fas fa-tree" style="color: #4CAF50;"></i> <b>${upgradeCosts.wood}</b></span>
                        <span><i class="fas fa-mountain" style="color: #9E9E9E;"></i> <b>${upgradeCosts.ore}</b></span>
                        <span><i class="fas fa-coins" style="color: #FFD700;"></i> <b>${upgradeCosts.gold}</b></span>
                    </div>
                </div>
                <button class="castle-btn upgrade-btn" id="mine-upgrade-btn-${buildingCoords.x}-${buildingCoords.y}" style="margin-top: 10px;">
                    Улучшить
                </button>
                ` : (currentLevel === 10 ? '<p style="color: #FFD700; font-weight: bold;">Достигнут максимальный уровень</p>' : '<p style="color: #aaa;">Захватите здание, чтобы улучшать его.</p>')}
            </div>
            <div class="castle-section" style="margin-bottom: 0;">
                <h3>Информация</h3>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <span>Уровень:</span>
                    <span style="font-weight: bold; color: gold;">${currentLevel > 0 ? currentLevel : 1}</span>
            </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <i class="fas fa-mountain" style="color: #9E9E9E;"></i>
                    <span>Руда: <b>${currentOreProduction}</b>/день</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-coins" style="color: #FFD700;"></i>
                    <span>Золото: <b>${currentGoldProduction}</b>/день</span>
                </div>
                ${mine ? `<p style="margin-top: 8px;">Владелец: <b>${mine.owner}</b></p>` : '<p style="margin-top: 8px;">Владелец: отсутствует</p>'}
            </div>
            ${!mine ? `
            <div class="castle-section">
                <button class="castle-btn capture-btn" id="mine-capture-btn-${buildingCoords.x}-${buildingCoords.y}">Захватить шахту</button>
            </div>
            ` : (mine.owner === this.username ? `
            <div class="castle-section">
                <button class="castle-btn relinquish-btn" id="mine-relinquish-btn-${buildingCoords.x}-${buildingCoords.y}">Отозвать владение</button>
            </div>
            ` : `
            <div class="castle-section">
                <p>Эта шахта уже захвачена игроком ${mine.owner}</p>
            </div>
            `)}
        `;

        // Собираем окно
        window.appendChild(header);
        window.appendChild(content);
        modal.appendChild(window);

        // Добавляем окно на страницу
        document.body.appendChild(modal);

        // Добавляем обработчики событий
        const upgradeBtn = document.getElementById(`mine-upgrade-btn-${buildingCoords.x}-${buildingCoords.y}`);
        console.log('Кнопка улучшения найдена:', !!upgradeBtn);
        
        if (upgradeBtn && canUpgrade) {
            console.log('Проверка ресурсов для улучшения');
            const hasEnoughResources = this.resources.wood >= upgradeCosts.wood &&
                                     this.resources.ore >= upgradeCosts.ore &&
                                     this.resources.gold >= upgradeCosts.gold;
            console.log('Достаточно ресурсов:', hasEnoughResources);
            console.log('Текущие ресурсы:', this.resources);
            console.log('Требуемые ресурсы:', upgradeCosts);

            if (!hasEnoughResources) {
                upgradeBtn.disabled = true;
                upgradeBtn.textContent = 'Недостаточно ресурсов';
                console.log('Кнопка отключена: недостаточно ресурсов');
            } else {
                console.log('Добавление обработчика на кнопку улучшения');
                upgradeBtn.onclick = async () => {
                    console.log('=== Начало процесса улучшения шахты ===');
                    console.log('Нажата кнопка улучшения шахты');
                    try {
                        const result = await Swal.fire({
                            title: 'Подтверждение улучшения',
                            html: `Вы уверены, что хотите улучшить шахту до уровня ${nextLevel}? <br><br> Это потребует: <br> Дерево: ${upgradeCosts.wood}<br> Руда: ${upgradeCosts.ore}<br> Золото: ${upgradeCosts.gold}`,
                            icon: 'question',
                            showCancelButton: true,
                            confirmButtonText: 'Да, улучшить',
                            cancelButtonText: 'Отмена'
                        });
                        
                        console.log('Результат подтверждения:', result.isConfirmed);
                        
                        if (result.isConfirmed) {
                            console.log('Подтверждено улучшение шахты');
                            console.log('Отправка запроса на улучшение...');
                            await this.upgradeBuilding(buildingCoords.x, buildingCoords.y, 'MINE');
                            this.showMineWindow();
                        } else {
                            console.log('Улучшение отменено пользователем');
        }
                    } catch (error) {
                        console.error('Ошибка при улучшении шахты:', error);
                    }
                };
                console.log('Обработчик успешно добавлен');
            }
        } else {
            console.log('Кнопка улучшения не добавлена:', {
                buttonExists: !!upgradeBtn,
                canUpgrade: canUpgrade
            });
        }

        const captureBtn = document.getElementById(`mine-capture-btn-${buildingCoords.x}-${buildingCoords.y}`);
        if (captureBtn) {
            captureBtn.addEventListener('click', async () => {
                await this.captureBuilding(correctedHeroX, correctedHeroY);
                this.updateMineWindowContent();
            });
        }

        const relinquishBtn = document.getElementById(`mine-relinquish-btn-${buildingCoords.x}-${buildingCoords.y}`);
        if (relinquishBtn) {
            relinquishBtn.addEventListener('click', async () => {
                await this.relinquishBuilding(correctedHeroX, correctedHeroY, 'M');
            });
        }

        // Добавляем обработчик для закрытия окна
        const closeBtn = modal.querySelector('.castle-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeCastleWindow();
            });
        }

        const hireArmyBtn = content.querySelector('.hire-army-btn');
        if (hireArmyBtn) {
            hireArmyBtn.addEventListener('click', () => {
                this.showHireArmyMenu();
            });
        }
    }

    async captureBuilding(x, y) {
        const terrainType = this.getTerrainType(x, y);
        
        // Проверяем, что герой стоит на клетке входа в здание
        if (terrainType === 'T' || terrainType === 'N') {
            // Находим само здание (S для лесопилки, M для шахты)
            const buildingType = terrainType === 'T' ? 'S' : 'M';
            const buildingCoords = this.findBuildingCoordinates(x, y, buildingType);
            
            if (buildingCoords) {
                try {
                    console.log('Пытаемся захватить здание:', buildingCoords.x, buildingCoords.y, buildingType);
                    
                    // Показываем сообщение об успехе сразу
                    Swal.fire({
                        title: 'Успех!',
                        text: `Вы захватили ${buildingType === 'S' ? 'лесопилку' : 'шахту'}!`,
                        icon: 'success',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                    
                    // Отправляем запрос на сервер
                    let response = await fetch('http://localhost:8000/api', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            action: 'capture_building',
                            userId: this.userId,
                            x: buildingCoords.x,
                            y: buildingCoords.y,
                            buildingType: buildingType === 'S' ? 'SAWMILL' : 'MINE'
                        })
                    });

                    let data = await response.json();
                    console.log('Ответ сервера при захвате здания:', data);

                    // Если первая попытка не удалась, пробуем еще раз без сообщения об ошибке
                    if (!data.success) {
                        console.log('Первая попытка захвата не удалась, пробуем еще раз...');
                        
                        // Даем немного времени базе данных для обработки
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        response = await fetch('http://localhost:8000/api', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                action: 'capture_building',
                                userId: this.userId,
                                x: buildingCoords.x,
                                y: buildingCoords.y,
                                buildingType: buildingType === 'S' ? 'SAWMILL' : 'MINE'
                            })
                        });
                        
                        data = await response.json();
                        console.log('Ответ сервера при повторном захвате здания:', data);
                    }

                    // Принудительно ждем, чтобы сервер успел обновить данные
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Принудительно загружаем актуальные данные о зданиях с сервера
                    await this.loadCapturedBuildings();

                    // Обновляем локальную информацию о здании в любом случае
                    if (buildingType === 'S') {
                        // Проверяем, есть ли уже такая лесопилка в списке
                        const exists = this.capturedBuildings.sawmills.some(
                            b => b.x === buildingCoords.x && b.y === buildingCoords.y
                        );
                        
                        if (!exists) {
                            this.capturedBuildings.sawmills.push({
                                x: buildingCoords.x,
                                y: buildingCoords.y,
                                level: 1,
                                production: this.BUILDING_LEVELS.SAWMILL[1].wood,
                                owner: this.username
                            });
                        }
                    } else {
                        // Проверяем, есть ли уже такая шахта в списке
                        const exists = this.capturedBuildings.mines.some(
                            b => b.x === buildingCoords.x && b.y === buildingCoords.y
                        );
                        
                        if (!exists) {
                            this.capturedBuildings.mines.push({
                                x: buildingCoords.x,
                                y: buildingCoords.y,
                                level: 1,
                                oreProduction: this.BUILDING_LEVELS.MINE[1].ore,
                                goldProduction: this.BUILDING_LEVELS.MINE[1].gold,
                                owner: this.username
                            });
                        }
                    }

                    // Обновляем отображение ресурсов
                    this.updateResourcesDisplay();

                    // Закрываем текущее окно
                    this.closeCastleWindow();
                    
                    // Сразу открываем новое окно с обновленной информацией
                    if (buildingType === 'S') {
                        this.showSawmillWindow();
                    } else {
                        this.showMineWindow();
                    }
                    
                    return true;
                } catch (error) {
                    console.error('Ошибка при захвате здания:', error);
                    return false;
                }
            }
        }
        return false;
    }

    // Метод для поиска координат здания по координатам входа
    findBuildingCoordinates(entranceX, entranceY, buildingType) {
        // Проверяем соседние клетки вокруг входа
        const directions = [
            { dx: 0, dy: -1 }, // вверх
            { dx: 1, dy: 0 },  // вправо
            { dx: 0, dy: 1 },  // вниз
            { dx: -1, dy: 0 }  // влево
        ];

        for (const dir of directions) {
            const x = entranceX + dir.dx;
            const y = entranceY + dir.dy;
            const terrain = this.getTerrainType(x, y);
            
            if (terrain === buildingType) {
                return { x, y };
            }
        }
        
        return null;
    }

    // Метод для проверки, захвачено ли здание
    isBuildingCaptured(x, y) {
        return this.capturedBuildings.sawmills.some(b => b.x === x && b.y === y) ||
               this.capturedBuildings.mines.some(b => b.x === x && b.y === y);
    }

    // Метод для обновления отображения ресурсов
    updateResourcesDisplay() {
        // Создаем контейнер для ресурсов, если его еще нет
        let resourcesContainer = document.querySelector('.resources-container');
        if (!resourcesContainer) {
            resourcesContainer = document.createElement('div');
            resourcesContainer.className = 'resources-container';
            document.querySelector('.game-header').appendChild(resourcesContainer);
        }

        // Обновляем содержимое контейнера
        resourcesContainer.innerHTML = `
            <div class="resource">
                <i class="fas fa-tree"></i>
                <span>${this.resources.wood}</span>
            </div>
            <div class="resource">
                <i class="fas fa-mountain"></i>
                <span>${this.resources.ore}</span>
            </div>
            <div class="resource">
                <i class="fas fa-coins"></i>
                <span>${this.resources.gold}</span>
            </div>
        `;

        // Обновляем ресурсы в окне замка, если оно открыто
        const castleWindow = document.querySelector('.castle-window');
        if (castleWindow) {
            const resourcesSection = castleWindow.querySelector('.castle-section');
            if (resourcesSection) {
                const resourcesContent = resourcesSection.querySelector('p');
                if (resourcesContent) {
                    resourcesContent.textContent = `Дерево: ${this.resources.wood}, Руда: ${this.resources.ore}, Золото: ${this.resources.gold}`;
                }
            }
        }
    }

    async relinquishBuilding(x, y, buildingType) {
        try {
            // Находим координаты здания
            const buildingCoords = this.findBuildingCoordinates(x, y, buildingType);
            
            if (buildingCoords) {
                // Показываем подтверждение
                const result = await Swal.fire({
                    title: 'Подтверждение',
                    text: `Вы уверены, что хотите отозвать владение ${buildingType === 'S' ? 'лесопилкой' : 'шахтой'}?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Да, отозвать',
                    cancelButtonText: 'Отмена'
                });

                if (result.isConfirmed) {
                    // Отправляем запрос на сервер
                    const response = await fetch('http://localhost:8000/api', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            action: 'relinquish_building',
                            userId: this.userId,
                            x: buildingCoords.x,
                            y: buildingCoords.y,
                            buildingType: buildingType === 'S' ? 'SAWMILL' : 'MINE'
                        })
                    });

                    const data = await response.json();
                    
                    if (data.success) {
                        // Показываем сообщение об успехе
                        Swal.fire({
                            title: 'Успех!',
                            text: `Вы отозвали владение ${buildingType === 'S' ? 'лесопилкой' : 'шахтой'}!`,
                            icon: 'success',
                            toast: true,
                            position: 'top-end',
                            showConfirmButton: false,
                            timer: 3000
                        });

                        // Удаляем здание из локального списка
                        if (buildingType === 'S') {
                            this.capturedBuildings.sawmills = this.capturedBuildings.sawmills.filter(
                                b => !(b.x === buildingCoords.x && b.y === buildingCoords.y)
                            );
                        } else {
                            this.capturedBuildings.mines = this.capturedBuildings.mines.filter(
                                b => !(b.x === buildingCoords.x && b.y === buildingCoords.y)
                            );
                        }

                        // Обновляем отображение ресурсов
                        this.updateResourcesDisplay();

                        // Закрываем текущее окно
                        this.closeCastleWindow();
                        
                        // Сразу открываем новое окно с обновленной информацией
                        if (buildingType === 'S') {
                            this.showSawmillWindow();
                        } else {
                            this.showMineWindow();
                        }
                    } else {
                        Swal.fire({
                            title: 'Ошибка!',
                            text: data.message || 'Не удалось отозвать владение зданием',
                            icon: 'error'
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка при отзыве владения зданием:', error);
            Swal.fire({
                title: 'Ошибка!',
                text: 'Произошла ошибка при отзыве владения зданием',
                icon: 'error'
            });
        }
    }

    // Метод для загрузки захваченных зданий
    async loadCapturedBuildings() {
        try {
            console.log('Начинаем загрузку информации о захваченных зданиях');

            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_user_buildings',
                    userId: this.userId
                })
            });

            const data = await response.json();
            console.log('Ответ от сервера при загрузке зданий:', data);

            if (data.success && data.buildings) {
                // Обновляем данные о захваченных зданиях
                this.capturedBuildings = data.buildings;
                console.log('Загружены данные о зданиях:', this.capturedBuildings);
            } else {
                console.warn('Сервер вернул ошибку или нет данных о зданиях:', data);
            }
        } catch (error) {
            console.error('Ошибка при загрузке данных о зданиях:', error);
        }
    }

    

    

    // Метод для улучшения здания
    async upgradeBuilding(x, y, buildingType) {
        try {
            console.log('Отправка запроса на улучшение здания:', { x, y, buildingType });
            const response = await fetch('/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'upgrade_building',
                    userId: this.userId,
                    x: x,
                    y: y,
                    buildingType: buildingType
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Ответ сервера:', data);
            
            if (data.success) {
                // Обновляем информацию о захваченных зданиях
                await this.loadCapturedBuildings();
                // Обновляем ресурсы игрока
                await this.loadResources();
                // Обновляем отображение ресурсов
                this.updateResourcesDisplay();
                
                // Показываем уведомление об успешном улучшении
                await Swal.fire({
                    title: 'Успех!',
                    text: 'Здание успешно улучшено',
                    icon: 'success',
                    confirmButtonText: 'OK',
                    customClass: {
                        container: 'swal-over-modal'
                    }
                });
            } else {
                throw new Error(data.message || 'Неизвестная ошибка при улучшении здания');
            }
        } catch (error) {
            console.error('Ошибка при улучшении здания:', error);
            await Swal.fire({
                title: 'Ошибка!',
                text: error.message || 'Произошла ошибка при улучшении здания',
                icon: 'error',
                confirmButtonText: 'OK',
                customClass: {
                    container: 'swal-over-modal'
                }
            });
        }
    }

    // Метод для обновления содержимого окна лесопилки
    async updateSawmillWindowContent() {
        console.log('Начало обновления содержимого окна лесопилки');
        const modal = document.getElementById('buildingModal');
        const content = document.getElementById('buildingContent');
        
        if (!modal || !content) {
            console.error('Модальное окно или его содержимое не найдено');
            return;
        }

        const buildingCoords = this.findBuildingCoordinates(this.heroX, this.heroY, 'SAWMILL');
        if (!buildingCoords) {
            console.error('Координаты здания не найдены');
            return;
        }

        try {
            const response = await fetch('/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'get_building_info',
                    x: buildingCoords.x,
                    y: buildingCoords.y,
                    building_type: 'SAWMILL'
                })
            });
        
            const data = await response.json();
            if (!data.success) {
                console.error('Ошибка получения информации о здании:', data.message);
                return;
            }

            const building = data.building;
            const isCaptured = this.isBuildingCaptured(buildingCoords.x, buildingCoords.y);
            const canUpgrade = isCaptured && building.level < 10;

            // Рассчитываем текущее и следующее производство
            const baseProduction = 80; // Базовое производство дерева
            const currentProduction = Math.floor(baseProduction * Math.pow(1.5, building.level - 1));
            const nextProduction = Math.floor(baseProduction * Math.pow(1.5, building.level));

            // Рассчитываем стоимость улучшения
            const upgradeCosts = {
                wood: Math.floor(currentProduction * 0.45), // 45% от текущей добычи
                ore: Math.floor(currentProduction * 0.35),  // 35% от текущей добычи
                gold: Math.floor(currentProduction * 0.20)  // 20% от текущей добычи
            };

            const hasEnoughResources = this.resources.wood >= upgradeCosts.wood &&
                                     this.resources.ore >= upgradeCosts.ore &&
                                     this.resources.gold >= upgradeCosts.gold;
            
            content.innerHTML = `
                <div class="building-header">
                    <h2>Лесопилка</h2>
                    <button class="close-btn" onclick="game.closeBuildingWindow()">×</button>
                </div>
                <div class="building-content">
                    <p>Уровень: ${building.level}</p>
                    <p>Производство: ${currentProduction} <i class="fas fa-tree"></i> в день</p>
                        ${canUpgrade ? `
                        <div class="upgrade-section">
                            <h3>Улучшение до уровня ${building.level + 1}</h3>
                            <p>Новое производство: ${nextProduction} <i class="fas fa-tree"></i> в день</p>
                            <p>Стоимость улучшения:</p>
                            <ul>
                                <li>${upgradeCosts.wood} <i class="fas fa-tree"></i></li>
                                <li>${upgradeCosts.ore} <i class="fas fa-mountain"></i></li>
                                <li>${upgradeCosts.gold} <i class="fas fa-coins"></i></li>
                            </ul>
                            <button class="upgrade-btn" ${!hasEnoughResources ? 'disabled' : ''} 
                                    onclick="game.upgradeBuilding(${buildingCoords.x}, ${buildingCoords.y}, 'SAWMILL')">
                                Улучшить
                            </button>
                    </div>
                    ` : ''}
                    ${!isCaptured ? `
                        <button class="capture-btn" onclick="game.captureBuilding(${buildingCoords.x}, ${buildingCoords.y}, 'SAWMILL')">
                            Захватить
                        </button>
                    ` : `
                        <button class="relinquish-btn" onclick="game.relinquishBuilding(${buildingCoords.x}, ${buildingCoords.y}, 'SAWMILL')">
                            Отказаться
                        </button>
                    `}
                </div>
            `;
        } catch (error) {
            console.error('Ошибка при обновлении окна лесопилки:', error);
        }
    }

    async updateMineWindowContent() {
        console.log('Начало обновления содержимого окна шахты');
        const modal = document.getElementById('buildingModal');
        const content = document.getElementById('buildingContent');
        
        if (!modal || !content) {
            console.error('Модальное окно или его содержимое не найдено');
            return;
        }

        const buildingCoords = this.findBuildingCoordinates(this.heroX, this.heroY, 'MINE');
        if (!buildingCoords) {
            console.error('Координаты здания не найдены');
            return;
        }

        try {
            const response = await fetch('/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'get_building_info',
                    x: buildingCoords.x,
                    y: buildingCoords.y,
                    building_type: 'MINE'
                })
            });

            const data = await response.json();
            if (!data.success) {
                console.error('Ошибка получения информации о здании:', data.message);
                return;
            }

            const building = data.building;
            const isCaptured = this.isBuildingCaptured(buildingCoords.x, buildingCoords.y);
            const canUpgrade = isCaptured && building.level < 10;

            // Рассчитываем текущее и следующее производство
            const baseOreProduction = 60; // Базовое производство руды
            const baseGoldProduction = 40; // Базовое производство золота
            const currentOreProduction = Math.floor(baseOreProduction * Math.pow(1.5, building.level - 1));
            const currentGoldProduction = Math.floor(baseGoldProduction * Math.pow(1.5, building.level - 1));
            const nextOreProduction = Math.floor(baseOreProduction * Math.pow(1.5, building.level));
            const nextGoldProduction = Math.floor(baseGoldProduction * Math.pow(1.5, building.level));
            const upgradeCosts = canUpgrade ? {
                wood: Math.floor(currentOreProduction * 0.45),
                ore: Math.floor(currentOreProduction * 0.35),
                gold: Math.floor(currentOreProduction * 0.20)
            } : null;

            const hasEnoughResources = this.resources.wood >= upgradeCosts.wood &&
                                     this.resources.ore >= upgradeCosts.ore &&
                                     this.resources.gold >= upgradeCosts.gold;
            
            content.innerHTML = `
                <div class="building-header">
                    <h2>Шахта</h2>
                    <button class="close-btn" onclick="game.closeBuildingWindow()">×</button>
                </div>
                <div class="building-content">
                    <p>Уровень: ${building.level}</p>
                    <p>Производство:</p>
                        <ul>
                        <li>${currentOreProduction} <i class="fas fa-mountain"></i> в день</li>
                        <li>${currentGoldProduction} <i class="fas fa-coins"></i> в день</li>
                        </ul>
                        ${canUpgrade ? `
                        <div class="upgrade-section">
                            <h3>Улучшение до уровня ${building.level + 1}</h3>
                            <p>Новое производство:</p>
                            <ul>
                                <li>${nextOreProduction} <i class="fas fa-mountain"></i> в день</li>
                                <li>${nextGoldProduction} <i class="fas fa-coins"></i> в день</li>
                            </ul>
                            <p>Стоимость улучшения:</p>
                            <ul>
                                <li>${upgradeCosts.wood} <i class="fas fa-tree"></i></li>
                                <li>${upgradeCosts.ore} <i class="fas fa-mountain"></i></li>
                                <li>${upgradeCosts.gold} <i class="fas fa-coins"></i></li>
                            </ul>
                            <button class="upgrade-btn" ${!hasEnoughResources ? 'disabled' : ''} 
                                    onclick="game.upgradeBuilding(${buildingCoords.x}, ${buildingCoords.y}, 'MINE')">
                                Улучшить
                            </button>
                    </div>
                    ` : ''}
                    ${!isCaptured ? `
                        <button class="capture-btn" onclick="game.captureBuilding(${buildingCoords.x}, ${buildingCoords.y}, 'MINE')">
                            Захватить
                        </button>
                    ` : `
                        <button class="relinquish-btn" onclick="game.relinquishBuilding(${buildingCoords.x}, ${buildingCoords.y}, 'MINE')">
                            Отказаться
                        </button>
                    `}
                </div>
            `;
        } catch (error) {
            console.error('Ошибка при обновлении окна шахты:', error);
        }
    }

    // Вспомогательный метод для проверки возможности улучшения
    canAffordUpgrade(costs) {
        return this.resources.wood >= costs.wood &&
               this.resources.ore >= costs.ore &&
               this.resources.gold >= costs.gold;
    }

    // === [АРМИЯ] ===
    async showHireArmyMenu() {
        const unitNames = {
            'ARCHER': 'Лучник',
            'SWORDSMAN': 'Мечник',
            'TANK': 'Кавалерист'
        };
        // Сохраняем текущее окно замка для возможности возврата
        const castleWindow = document.querySelector('.castle-modal');
        if (castleWindow) {
            castleWindow.style.display = 'none';
        }

        // Создаем модальное окно для найма армии
        const modal = document.createElement('div');
        modal.className = 'army-hire-modal';

        const window = document.createElement('div');
        window.className = 'army-hire-window';

        // Добавляем заголовок
        const header = document.createElement('div');
        header.className = 'army-hire-header';
        header.innerHTML = `
            <h2>Найм армии</h2>
            <button class="army-hire-close">&times;</button>
        `;

        const content = document.createElement('div');
        content.className = 'army-hire-content';
        content.innerHTML = '<div style="text-align:center;">Загрузка...</div>';

        window.appendChild(header);
        window.appendChild(content);
        modal.appendChild(window);
        document.body.appendChild(modal);

        // Обработчик закрытия и возврата к окну замка
        const closeModal = () => {
            modal.remove();
            if (castleWindow) {
                castleWindow.style.display = '';
            }
        };

        modal.querySelector('.army-hire-close').onclick = closeModal;

        // Загружаем типы юнитов
        try {
            const response = await fetch('/api', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({action: 'get_unit_types'})
            });
            const data = await response.json();

            if (!data.success) {
                content.innerHTML = '<div style="text-align:center;color:#ff6b6b;">Ошибка загрузки</div>';
                return;
            }

            let html = '<div class="unit-types-list">';
            data.types.forEach(type => {
                // Определяем путь к иконке
                let icon = '';
                if (["ARCHER","SWORDSMAN","TANK"].includes(type.unitType)) {
                    icon = `<img src='textures/${type.unitType}.png' alt='' style='width:32px;height:32px;vertical-align:middle;margin-right:6px;'>`;
                }
                html += `<button class="unit-type-btn" data-type="${type.unitType}" data-attack="${type.attack}" data-defense="${type.defense}" data-health="${type.health}" data-wood="${type.woodCost}" data-ore="${type.oreCost}" data-gold="${type.goldCost}">
                    ${icon}<span class="unit-label">${unitNames[type.unitType] || type.unitType}</span>
                    <span class="unit-stats">Атака: ${type.attack}</span>
                    <span class="unit-stats">Защита: ${type.defense}</span>
                    <span class="unit-stats">Здоровье: ${type.health}</span>
                </button>`;
            });
            html += '</div>';
            html += '<div class="army-hire-details"></div>';
            html += '<div class="army-hire-count"><label>Количество:</label><input type="number" min="1" value="1"></div>';
            html += '<div class="army-hire-calc"><span><i class="fas fa-tree"></i> Дерево: <b class="calc-wood">0</b></span><span><i class="fas fa-mountain"></i> Руда: <b class="calc-ore">0</b></span><span><i class="fas fa-coins"></i> Золото: <b class="calc-gold">0</b></span></div>';
            html += '<div class="army-hire-actions">';
            html += '<button class="army-hire-btn army-hire-confirm">Нанять</button>';
            html += '<button class="army-hire-btn army-hire-cancel">Отмена</button>';
            html += '</div>';
            html += '<div class="army-hire-message"></div>';
            content.innerHTML = html;

            let selectedType = null;
            let selectedTypeData = null;
            const detailsDiv = content.querySelector('.army-hire-details');
            const typeBtns = Array.from(content.querySelectorAll('.unit-type-btn'));
            const countInput = content.querySelector('.army-hire-count input');
            const calcWood = content.querySelector('.calc-wood');
            const calcOre = content.querySelector('.calc-ore');
            const calcGold = content.querySelector('.calc-gold');
            const messageDiv = content.querySelector('.army-hire-message');

            function updateCalc() {
                if (!selectedTypeData) {
                    calcWood.textContent = '0';
                    calcOre.textContent = '0';
                    calcGold.textContent = '0';
                    return;
                }
                const count = parseInt(countInput.value) || 1;
                calcWood.textContent = selectedTypeData.woodCost * count;
                calcOre.textContent = selectedTypeData.oreCost * count;
                calcGold.textContent = selectedTypeData.goldCost * count;
            }

            typeBtns.forEach(btn => {
                btn.onclick = () => {
                    typeBtns.forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    selectedType = btn.dataset.type;
                    selectedTypeData = {
                        unitType: btn.dataset.type,
                        attack: btn.dataset.attack,
                        defense: btn.dataset.defense,
                        health: btn.dataset.health,
                        woodCost: parseInt(btn.dataset.wood),
                        oreCost: parseInt(btn.dataset.ore),
                        goldCost: parseInt(btn.dataset.gold)
                    };
                    // Используем русское название
                    detailsDiv.innerHTML = `<b>${unitNames[btn.dataset.type] || btn.dataset.type}</b><br>Атака: ${btn.dataset.attack}<br>Защита: ${btn.dataset.defense}<br>Здоровье: ${btn.dataset.health}<br>Стоимость: ${btn.dataset.wood} дерева, ${btn.dataset.ore} руды, ${btn.dataset.gold} золота за 1`;
                    updateCalc();
                };
            });

            countInput.addEventListener('input', updateCalc);

            // Кнопка найма
            content.querySelector('.army-hire-confirm').onclick = async () => {
                const count = parseInt(countInput.value);
                if (!selectedType || !count || count < 1) {
                    messageDiv.textContent = 'Выберите тип и количество';
                    messageDiv.style.color = '#ff6b6b';
                    return;
                }

                const x = this.castleX;
                const y = this.castleY + 2;
                const res = await fetch('/api', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        action: 'hire_army',
                        userId: this.userId,
                        unitType: selectedType,
                        count,
                        x,
                        y
                    })
                });
                const data = await res.json();
                
                if (data.success) {
                    messageDiv.textContent = 'Армия нанята!';
                    messageDiv.style.color = '#2ecc71';
                    // Динамически обновляем ресурсы и армию после найма
                    await this.loadResources();
                    await this.loadUserArmy();
                    // Всегда обновляем армию в замке после найма
                    await this.loadUserArmyForCastle();
                    setTimeout(closeModal, 800);
                } else {
                    messageDiv.textContent = data.message;
                    messageDiv.style.color = '#ff6b6b';
                }
            };

            // Кнопка отмены
            content.querySelector('.army-hire-cancel').onclick = closeModal;

        } catch (error) {
            console.error('Ошибка при загрузке меню найма армии:', error);
            content.innerHTML = '<div style="text-align:center;color:#ff6b6b;">Ошибка загрузки</div>';
        }
    }

    

    selectArmyUnit(unit) {
        // Словарь описаний юнитов
        const unitDescriptions = {
            'ARCHER': {
                name: 'Лучник',
                description: 'Лучник — базовый стрелок. Может атаковать на расстоянии. Имеет средние показатели атаки и защиты.',
                image: 'textures/ARCHER.png'
            },
            'SWORDSMAN': {
                name: 'Мечник',
                description: 'Мечник — универсальный воин ближнего боя. Хорошо защищён и наносит стабильный урон.',
                image: 'textures/SWORDSMAN.png'
            },
            'TANK': {
                name: 'Кавалерист',
                description: 'Кавалерист — тяжёлый юнит с большим запасом здоровья и защиты, но низкой скоростью.',
                image: 'textures/TANK.png'
            }
        };
        const info = unitDescriptions[unit.unitType] || {
            name: unit.unitType,
            description: 'Нет описания для этого типа юнита.',
            image: ''
        };

        // Удаляем старое модальное окно, если оно есть
        const oldModal = document.getElementById('unit-info-modal');
        if (oldModal) oldModal.remove();

        // Создаём модальное окно
        const modal = document.createElement('div');
        modal.id = 'unit-info-modal';
        modal.style.position = 'fixed';
        modal.style.left = '0';
        modal.style.top = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';

        const windowDiv = document.createElement('div');
        windowDiv.style.background = '#222';
        windowDiv.style.borderRadius = '12px';
        windowDiv.style.padding = '32px 24px';
        windowDiv.style.boxShadow = '0 4px 32px #000a';
        windowDiv.style.minWidth = '320px';
        windowDiv.style.maxWidth = '90vw';
        windowDiv.style.color = '#fff';
        windowDiv.style.position = 'relative';
        windowDiv.style.textAlign = 'center';

        // Кнопка закрытия
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '12px';
        closeBtn.style.right = '16px';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.fontSize = '2em';
        closeBtn.style.color = '#fff';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = () => modal.remove();
        windowDiv.appendChild(closeBtn);

        // Фото юнита
        if (info.image) {
            const img = document.createElement('img');
            img.src = info.image;
            img.alt = info.name;
            img.style.width = '96px';
            img.style.height = '96px';
            img.style.objectFit = 'contain';
            img.style.marginBottom = '12px';
            windowDiv.appendChild(img);
        }

        // Название
        const nameEl = document.createElement('h2');
        nameEl.textContent = info.name;
        nameEl.style.margin = '8px 0 8px 0';
        windowDiv.appendChild(nameEl);

        // Описание
        const descEl = document.createElement('div');
        descEl.textContent = info.description;
        descEl.style.marginBottom = '16px';
        windowDiv.appendChild(descEl);

        // Характеристики
        const stats = document.createElement('div');
        stats.innerHTML = `
            <b>Количество:</b> ${unit.count}<br>
            <b>Атака:</b> ${unit.attack}<br>
            <b>Защита:</b> ${unit.defense}<br>
            <b>Здоровье одного:</b> ${unit.health}<br>
            <b>Общее здоровье:</b> ${unit.count * unit.health}
        `;
        stats.style.marginBottom = '8px';
        windowDiv.appendChild(stats);

        modal.appendChild(windowDiv);
        document.body.appendChild(modal);
    }

    // === [АРМИЯ В ЗАМКЕ] ===
    async loadUserArmyForCastle() {
        const unitNames = {
            'ARCHER': 'Лучник',
            'SWORDSMAN': 'Мечник',
            'TANK': 'Кавалерист'
        };
        const armyDiv = document.getElementById('castleArmyList');
        if (!armyDiv) return;
        armyDiv.innerHTML = 'Загрузка...';
        try {
            const res = await fetch('/api', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'get_user_army',userId:this.userId})});
            const data = await res.json();
            if (data.success && data.army && data.army.length > 0) {
                // Группируем по типу
                const grouped = {};
                data.army.forEach(unit => {
                    if (!grouped[unit.unitType]) {
                        grouped[unit.unitType] = {
                            unitType: unit.unitType,
                            count: 0,
                            totalHealth: 0,
                            attack: unit.attack,
                            defense: unit.defense,
                            health: unit.health
                        };
                    }
                    grouped[unit.unitType].count += unit.count;
                    grouped[unit.unitType].totalHealth += unit.count * unit.health;
                });
                armyDiv.innerHTML = Object.values(grouped).map(unit => {
                    let icon = '';
                    if (["ARCHER","SWORDSMAN","TANK"].includes(unit.unitType)) {
                        icon = `<img src='textures/${unit.unitType}.png' alt='' style='width:28px;height:28px;vertical-align:middle;margin-right:6px;'>`;
                    }
                    return `<div class=\"castle-army-unit\">${icon}<b>${unitNames[unit.unitType] || unit.unitType}</b> (${unit.count})<br>
                        <span style='font-size:12px;'>Атака: ${unit.attack}, Защита: ${unit.defense}, Здоровье одного: ${unit.health}</span><br>
                        <span style='font-size:12px;color:#4caf50;'>Общее здоровье: ${unit.totalHealth}</span>
                    </div>`;
                }).join('');
            } else {
                armyDiv.innerHTML = '<span style=\"color:#aaa;\">Нет армии</span>';
            }
        } catch (e) {
            armyDiv.innerHTML = '<span style=\"color:#f66;\">Ошибка загрузки</span>';
        }
    }

    // Вспомогательный метод для определения типа замка по координатам
    getCastleType(x, y) {
        console.log(`[DEBUG] getCastleType вызвана с координатами: x=${x}, y=${y}`);
        
        // Координаты всех замков на карте (пример: три замка)
        const mapLines = this.mapData.split('\n');
        const mapWidth = mapLines[0] ? mapLines[0].length : 0;
        const mapHeight = mapLines.length;
        const castles = [
            { x: Math.trunc(mapWidth * 0.2), y: Math.trunc(mapHeight * 0.2) },
            { x: Math.trunc(mapWidth * 0.8), y: Math.trunc(mapHeight * 0.2) },
            { x: Math.trunc(mapWidth * 0.5), y: Math.trunc(mapHeight * 0.8) }
        ];
        
        console.log(`[DEBUG] Размеры карты: ${mapWidth}x${mapHeight}`);
        console.log(`[DEBUG] Координаты замков:`, castles);
        
        if (x === castles[0].x && y === castles[0].y) {
            console.log(`[DEBUG] Определен как player castle (координаты совпадают с замком 0)`);
            return 'player';
        }
        if ((x === castles[1].x && y === castles[1].y) || (x === castles[2].x && y === castles[2].y)) {
            console.log(`[DEBUG] Определен как enemy castle (координаты совпадают с замком 1 или 2)`);
            return 'enemy';
        }
        
        // Также если символ X или Y — enemy, C/E — player
        const terrain = mapLines[y]?.[x];
        console.log(`[DEBUG] Символ на карте в позиции (${x},${y}): '${terrain}'`);
        
        if (terrain === 'C' || terrain === 'E') {
            console.log(`[DEBUG] Определен как player castle (символ ${terrain})`);
            return 'player';
        }
        if (terrain === 'X' || terrain === 'Y') {
            console.log(`[DEBUG] Определен как enemy castle (символ ${terrain})`);
            return 'enemy';
        }
        
        console.log(`[DEBUG] Определен как unknown castle`);
        return 'unknown';
    }

    // === Окно подготовки к бою за замок чертей ===
    async showBattlePreparationWindow() {
        // Перед боем всегда подгружаем актуальную армию из базы
        await this.loadUserArmy();
        // Проверяем, есть ли у юнитов x/y, если нет — добавляем координаты замка
        if (this.userArmy && this.userArmy.length > 0) {
            let missingXY = false;
            this.userArmy.forEach(u => {
                if (typeof u.x === 'undefined' || typeof u.y === 'undefined') missingXY = true;
            });
            if (missingXY) {
                // Обычно армия стоит в замке, координаты берём из замка
                this.userArmy = this.userArmy.map(u => ({...u, x: this.castleX, y: this.castleY + 2}));
            }
            console.log('[DEBUG] Армия перед боем:', this.userArmy);
        }
        // Удаляем старое модальное окно, если оно есть
        const oldModal = document.getElementById('battle-prep-modal');
        if (oldModal) oldModal.remove();

        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.id = 'battle-prep-modal';
        modal.style.position = 'fixed';
        modal.style.left = '0';
        modal.style.top = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.7)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';

        const windowDiv = document.createElement('div');
        windowDiv.style.background = '#222';
        windowDiv.style.borderRadius = '14px';
        windowDiv.style.padding = '32px 24px';
        windowDiv.style.boxShadow = '0 4px 32px #000a';
        windowDiv.style.minWidth = '340px';
        windowDiv.style.maxWidth = '95vw';
        windowDiv.style.color = '#fff';
        windowDiv.style.position = 'relative';
        windowDiv.style.textAlign = 'center';

        // Кнопка закрытия
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '12px';
        closeBtn.style.right = '16px';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.fontSize = '2em';
        closeBtn.style.color = '#fff';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = () => modal.remove();
        windowDiv.appendChild(closeBtn);

        // Заголовок
        const title = document.createElement('h2');
        title.textContent = 'Информация о бое';
        title.style.marginBottom = '18px';
        windowDiv.appendChild(title);

        // Состав вашей армии
        const yourArmyTitle = document.createElement('div');
        yourArmyTitle.textContent = 'Состав вашей армии:';
        yourArmyTitle.style.fontWeight = 'bold';
        yourArmyTitle.style.margin = '12px 0 6px 0';
        windowDiv.appendChild(yourArmyTitle);
        this.battleYourArmyTitle = yourArmyTitle; // Сохраняем ссылку для удаления после боя

        // Список армии игрока
        const armyListDiv = document.createElement('div');
        armyListDiv.style.marginBottom = '16px';
        this.battleArmyListDiv = armyListDiv; // Сохраняем ссылку для обновления после боя
        if (this.userArmy && this.userArmy.length > 0) {
            // Группируем по типу
            const unitNames = { 'ARCHER': 'Лучник', 'SWORDSMAN': 'Мечник', 'TANK': 'Кавалерист' };
            const grouped = {};
            this.userArmy.forEach(unit => {
                if (!grouped[unit.unitType]) {
                    grouped[unit.unitType] = {
                        unitType: unit.unitType,
                        count: 0,
                        attack: unit.attack,
                        defense: unit.defense,
                        health: unit.health
                    };
                }
                grouped[unit.unitType].count += unit.count;
            });
            armyListDiv.innerHTML = Object.values(grouped).map(unit => {
                let icon = '';
                if (["ARCHER","SWORDSMAN","TANK"].includes(unit.unitType)) {
                    icon = `<img src='textures/${unit.unitType}.png' alt='' style='width:28px;height:28px;vertical-align:middle;margin-right:6px;'>`;
                }
                return `<div style='margin-bottom:4px;'>${icon}<b>${unitNames[unit.unitType] || unit.unitType}</b> (${unit.count})</div>`;
            }).join('');
        } else {
            armyListDiv.innerHTML = '<span style="color:#aaa;">Нет армии</span>';
        }
        windowDiv.appendChild(armyListDiv);

        // Состав армии замка
        const enemyArmyTitle = document.createElement('div');
        enemyArmyTitle.textContent = 'Состав армии замка:';
        enemyArmyTitle.style.fontWeight = 'bold';
        enemyArmyTitle.style.margin = '18px 0 6px 0';
        windowDiv.appendChild(enemyArmyTitle);
        this.battleCastleArmyTitle = enemyArmyTitle; // Сохраняем ссылку для удаления после боя

        // Армия замка (12 чертей)
        const enemyArmyDiv = document.createElement('div');
        enemyArmyDiv.innerHTML = `<img src='textures/enemy.png' alt='' style='width:28px;height:28px;vertical-align:middle;margin-right:6px;'><b>Чёрт</b> (12)`;
        enemyArmyDiv.style.marginBottom = '18px';
        windowDiv.appendChild(enemyArmyDiv);
        this.battleEnemyArmyDiv = enemyArmyDiv; // Сохраняем ссылку для удаления после боя

        // Красная кнопка НАЧАТЬ БОЙ
        const fightBtn = document.createElement('button');
        fightBtn.textContent = 'НАЧАТЬ БОЙ';
        fightBtn.style.background = '#d32f2f';
        fightBtn.style.color = '#fff';
        fightBtn.style.border = '2px solid #b71c1c';
        fightBtn.style.boxShadow = '0 0 12px 2px #b71c1c88';
        fightBtn.style.fontWeight = 'bold';
        fightBtn.style.fontSize = '1.1em';
        fightBtn.style.padding = '12px 32px';
        fightBtn.style.marginTop = '10px';
        fightBtn.style.cursor = 'pointer';
        fightBtn.onmouseover = () => { fightBtn.style.background = '#b71c1c'; };
        fightBtn.onmouseout = () => { fightBtn.style.background = '#d32f2f'; };
        fightBtn.onclick = async () => {
            // Скрываем кнопку и выводим "Бой идет..."
            fightBtn.style.display = 'none';
            const battleStatus = document.createElement('div');
            battleStatus.textContent = 'Бой идет...';
            battleStatus.style.fontSize = '1.2em';
            battleStatus.style.fontWeight = 'bold';
            battleStatus.style.margin = '18px 0 12px 0';
            windowDiv.appendChild(battleStatus);
            // Имитация задержки боя
            await new Promise(r => setTimeout(r, 1800));
            // === ЛОГИКА БОЯ ===
            // Сила 1 черта (примерно):
            const devil = { attack: 8, defense: 6, health: 40, count: 12 };
            const devilPower = devil.count * (devil.attack + devil.defense + devil.health);
            // Суммарная сила игрока
            let playerPower = 0;
            let totalUnits = 0;
            // Берём копию актуальной армии с правильными x/y
            let army = (this.userArmy || []).map(u => ({...u}));
            army.forEach(u => {
                playerPower += u.count * (Number(u.attack) + Number(u.defense) + Number(u.health));
                totalUnits += u.count;
            });
            // Минимум для победы: 1.1x силы чертов (чтобы не было побед "впритык")
            const requiredPower = devilPower * 1.1;
            // Случайный коэффициент для разнообразия
            const luck = 0.9 + Math.random() * 0.2; // 0.9..1.1
            const finalPlayerPower = playerPower * luck;
            let win = finalPlayerPower >= requiredPower;
            // === Потери ===
            let losses = [];
            if (totalUnits > 0) {
                // Если победа — потери 20-60% от чертов (распределить по типам)
                // Если поражение — потери 60-100% всей армии
                let lossPercent = win ? (0.2 + Math.random() * 0.4) : (0.6 + Math.random() * 0.4);
                army.forEach(u => {
                    let lost = Math.floor(u.count * lossPercent * (0.8 + Math.random() * 0.4));
                    if (lost > u.count) lost = u.count;
                    losses.push({ unitType: u.unitType, lost, left: u.count - lost });
                });
            }
            // === Обновляем окно ===
            battleStatus.textContent = win ? 'Победа!' : 'Поражение...';
            battleStatus.style.color = win ? '#4caf50' : '#e53935';
            // Показываем потери (всегда, и при победе, и при поражении)
            const groupedLosses = {};
            losses.forEach(l => {
                if (!groupedLosses[l.unitType]) {
                    groupedLosses[l.unitType] = { lost: 0, total: 0, unitType: l.unitType };
                }
                groupedLosses[l.unitType].lost += l.lost;
                groupedLosses[l.unitType].total += l.lost + l.left;
            });
            const lossesDiv = document.createElement('div');
            lossesDiv.style.margin = '14px 0 0 0';
            lossesDiv.innerHTML = '<b>Потери:</b><br>' +
                (Object.keys(groupedLosses).length > 0
                    ? Object.values(groupedLosses).map(l => `${l.lost} из ${l.total} ${this.getUnitName(l.unitType)}`).join('<br>')
                    : '<span style="color:#aaa;">Нет армии</span>');
            windowDiv.appendChild(lossesDiv);
            
            // Убираем отображение состава армии после боя
            if (this.battleArmyListDiv) {
                this.battleArmyListDiv.remove();
                this.battleArmyListDiv = null;
            }
            // Убираем заголовки состава армии после боя
            if (this.battleYourArmyTitle) {
                this.battleYourArmyTitle.remove();
                this.battleYourArmyTitle = null;
            }
            if (this.battleCastleArmyTitle) {
                this.battleCastleArmyTitle.remove();
                this.battleCastleArmyTitle = null;
            }
            // Убираем отображение армии замка (Чёрт (12)) после боя
            if (this.battleEnemyArmyDiv) {
                this.battleEnemyArmyDiv.remove();
                this.battleEnemyArmyDiv = null;
            }
            
            // ОБЩАЯ ЛОГИКА: отправляем потери на сервер (и при победе, и при поражении)
            const updatedArmy = army.map((u, i) => ({
                ...u,
                count: losses[i] ? losses[i].left : u.count,
                x: u.x,
                y: u.y
            }));
            this.userArmy = updatedArmy.filter(u => u.count > 0);
            
            // Сохраняем потери в базе (отправляем ВСЕХ, даже с count=0)
            try {
                console.log('[DEBUG] Отправлено на сервер (update_army_after_battle):', updatedArmy);
                await fetch('/api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update_army_after_battle',
                        userId: this.userId,
                        army: updatedArmy
                    })
                });
                // После обновления армии на сервере — подгружаем актуальную армию из базы
                await this.loadUserArmy();
                console.log('[DEBUG] Армия после боя из базы:', this.userArmy);
            } catch (e) { console.error('Ошибка отправки потерь армии:', e); }
            
            // Если победа — показываем кнопку "Перейти в замок чертов"
            if (win) {
                // Ставим флаг, что только что был захвачен замок чертей
                this.enemyCastleJustCaptured = true;
                // Кнопка "Перейти в замок чертов"
                const goToCastleBtn = document.createElement('button');
                goToCastleBtn.textContent = 'Перейти в замок чертов';
                goToCastleBtn.className = 'castle-btn capture-btn';
                goToCastleBtn.style.marginTop = '18px';
                goToCastleBtn.style.background = '#4caf50';
                goToCastleBtn.style.color = '#fff';
                goToCastleBtn.style.border = '2px solid #388e3c';
                goToCastleBtn.style.boxShadow = '0 0 12px 2px #388e3c88';
                goToCastleBtn.style.fontWeight = 'bold';
                goToCastleBtn.style.fontSize = '1.1em';
                goToCastleBtn.style.padding = '12px 32px';
                goToCastleBtn.style.cursor = 'pointer';
                goToCastleBtn.onmouseover = () => { goToCastleBtn.style.background = '#388e3c'; };
                goToCastleBtn.onmouseout = () => { goToCastleBtn.style.background = '#4caf50'; };
                goToCastleBtn.onclick = async () => {
                    // Попытка удалить battle-prep-modal сразу
                    const prepModal = document.getElementById('battle-prep-modal');
                    if (prepModal) {
                        prepModal.remove();
                        console.log('battle-prep-modal удалён сразу');
                    } else {
                        console.log('battle-prep-modal не найден сразу');
                    }
                    // Попытка удалить через 100 мс (на случай, если что-то блокирует удаление)
                    setTimeout(() => {
                        const prepModal2 = document.getElementById('battle-prep-modal');
                        if (prepModal2) {
                            prepModal2.remove();
                            // alert('battle-prep-modal удалён через setTimeout');
                            console.log('battle-prep-modal удалён через setTimeout');
                        } else {
                            console.log('battle-prep-modal не найден через setTimeout');
                        }
                    }, 100);
                    
                    // Проверяем, не принадлежит ли замок уже игроку
                    try {
                        const castleInfo = await this.getCastleInfo();
                        console.log('[DEBUG] Кнопка "Перейти в замок чертов": информация о замке:', castleInfo);
                        
                        if (castleInfo && castleInfo.ownerId === parseInt(this.userId)) {
                            console.log('[DEBUG] Замок уже принадлежит игроку, просто открываем окно');
                            // Замок уже принадлежит игроку - просто открываем окно замка
                            this.enemyCastleJustCaptured = true;
                            this.showCastleWindow();
                            return;
                        }
                    } catch (error) {
                        console.error('[DEBUG] Ошибка при получении информации о замке:', error);
                    }
                    
                    // Замок не принадлежит игроку - пытаемся захватить
                    console.log('[DEBUG] Замок не принадлежит игроку, пытаемся захватить');
                    const captured = await this.captureEnemyCastleAfterBattle();
                    if (captured) {
                        // Открываем окно замка
                        this.showCastleWindow();
                    } else {
                        // Если не удалось захватить, показываем ошибку
                        await Swal.fire({
                            title: 'Ошибка',
                            text: 'Не удалось захватить замок чертей',
                            icon: 'error',
                            confirmButtonText: 'OK'
                        });
                    }
                };
                windowDiv.appendChild(goToCastleBtn);
            } else {
                // Если поражение — кнопка "Закрыть"
                const closeBtn = document.createElement('button');
                closeBtn.textContent = 'Закрыть';
                closeBtn.className = 'castle-btn';
                closeBtn.style.marginTop = '18px';
                closeBtn.onclick = () => modal.remove();
                windowDiv.appendChild(closeBtn);
            }
        };
        windowDiv.appendChild(fightBtn);

        modal.appendChild(windowDiv);
        document.body.appendChild(modal);
    }

    // Вспомогательный метод для отображения имени юнита по типу
    getUnitName(unitType) {
        const unitNames = {
            'ARCHER': 'Лучник',
            'SWORDSMAN': 'Мечник',
            'TANK': 'Кавалерист'
        };
        return unitNames[unitType] || unitType;
    }

    // Захват замка чертей после победы в бою (без проверки типа замка)
    async captureEnemyCastleAfterBattle() {
        try {
            console.log('[DEBUG] Начинаем захват замка чертей...');
            console.log('[DEBUG] Координаты героя:', this.heroX, this.heroY);
            console.log('[DEBUG] Координаты замка:', this.heroX - this.HERO_X_OFFSET, this.heroY - this.HERO_Y_OFFSET);
            console.log('[DEBUG] UserId:', this.userId);
            
            const requestBody = {
                action: 'capture_castle',
                userId: this.userId,
                castleX: this.heroX - this.HERO_X_OFFSET,
                castleY: this.heroY - this.HERO_Y_OFFSET
            };
            
            console.log('[DEBUG] Отправляем запрос:', requestBody);
            
            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log('[DEBUG] Получен ответ от сервера');
            const data = await response.json();
            console.log('[DEBUG] Данные ответа:', data);
            
            if (data.success) {
                console.log('Замок чертей успешно захвачен:', data.message);
                return true;
            } else {
                console.error('Ошибка при захвате замка чертей:', data.message);
                return false;
            }
        } catch (error) {
            console.error('Ошибка при захвате замка чертей:', error);
            return false;
        }
    }
}

// Запускаем игру при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});

// === ЧИТ-КОДЫ ===
document.addEventListener('keydown', async (e) => {
    if (e.altKey && (e.key === 'T' || e.key === 't' || e.key === 'Е' || e.key === 'е')) {
        e.preventDefault();
        const { value: cheat } = await Swal.fire({
            title: 'Введите чит-код',
            input: 'text',
            inputPlaceholder: 'Введите код...',
            showCancelButton: true,
            confirmButtonText: 'OK',
            cancelButtonText: 'Отмена'
        });
        if (!cheat) return;
        if (cheat === 'TATUR_ON') {
            // Открыть всю карту (все клетки исследованы)
            if (window.game && game.mapData) {
                const mapLines = game.mapData.split('\n');
                for (let y = 0; y < mapLines.length; y++) {
                    for (let x = 0; x < mapLines[y].length; x++) {
                        game.exploredTiles[`${x},${y}`] = true;
                    }
                }
                await game.saveExploredTiles();
                await game.drawMap();
                Swal.fire('Туман войны отключён!', '', 'success');
            }
        } else if (cheat === 'TATUR_OFF') {
            // Восстановить туман войны (только вокруг героя)
            if (window.game) {
                // Очищаем все исследованные клетки
                game.exploredTiles = {};
                await game.updateExploredTiles();
                await game.drawMap();
                Swal.fire('Туман войны включён!', '', 'info');
            }
        } else if (cheat === 'TATUR_MODE') {
            // Добавить по 100 ресурсов каждого типа
            if (window.game) {
                game.resources.wood += 100;
                game.resources.ore += 100;
                game.resources.gold += 100;
                game.updateResourcesDisplay();
                // Отправить на сервер (если сервер поддерживает)
                try {
                    await fetch('http://localhost:8000/api', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'cheat_add_resources',
                            userId: game.userId,
                            wood: 100,
                            ore: 100,
                            gold: 100
                        })
                    });
                    // После ответа сервера — обновить ресурсы из БД
                    await game.loadResources();
                } catch (e) {}
                Swal.fire('+100 ресурсов!', 'Дерево, руда и золото добавлены.', 'success');
            }
        } else {
            Swal.fire('Неизвестный код!', '', 'error');
        }
    }
});