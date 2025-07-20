document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');

    // Функция для переключения между вкладками
    function switchTab(event, tabName) {
        event.preventDefault();

        const tabContents = document.getElementsByClassName('tab-content');
        for (let content of tabContents) {
            content.classList.remove('active');
        }

        const tabButtons = document.getElementsByClassName('tab-btn');
        for (let button of tabButtons) {
            button.classList.remove('active');
        }

        document.getElementById(tabName).classList.add('active');
        event.target.classList.add('active');
    }

    // Добавляем обработчики для вкладок
    loginTab.addEventListener('click', (e) => switchTab(e, 'login'));
    registerTab.addEventListener('click', (e) => switchTab(e, 'register'));

    // Обработчик формы входа
    loginForm.addEventListener('submit', async(e) => {
        e.preventDefault();

        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'login',
                    username: username,
                    password: password
                })
            });

            const data = await response.json();

            if (data.success) {
                if (data.alreadyLoggedIn) {
                    await Swal.fire({
                        title: 'Ошибка',
                        text: 'Этот аккаунт уже используется',
                        icon: 'error',
                        confirmButtonText: 'OK'
                    });
                    return;
                }

                localStorage.setItem('userId', data.userId);
                localStorage.setItem('username', username);
                window.location.href = 'menu.html';
            } else {
                await Swal.fire({
                    title: 'Ошибка',
                    text: data.message || 'Неверное имя пользователя или пароль',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
        } catch (error) {
            console.error('Ошибка при входе:', error);
            await Swal.fire({
                title: 'Ошибка',
                text: 'Произошла ошибка при попытке входа',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    });

    // Обработчик формы регистрации
    registerForm.addEventListener('submit', async(e) => {
        e.preventDefault();

        const username = document.getElementById('registerUsername').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            await Swal.fire({
                title: 'Ошибка',
                text: 'Пароли не совпадают',
                icon: 'error',
                confirmButtonText: 'OK'
            });
            return;
        }

        try {
            const response = await fetch('http://localhost:8000/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'register',
                    username: username,
                    password: password
                })
            });

            const data = await response.json();

            if (data.success) {
                // После успешной регистрации сразу авторизуем пользователя
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('username', username);

                await Swal.fire({
                    title: 'Успех!',
                    text: 'Регистрация успешно завершена',
                    icon: 'success',
                    confirmButtonText: 'OK'
                });

                // Перенаправляем в меню
                window.location.href = 'menu.html';
            } else {
                await Swal.fire({
                    title: 'Ошибка',
                    text: data.message || 'Ошибка при регистрации',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
        } catch (error) {
            console.error('Ошибка при регистрации:', error);
            await Swal.fire({
                title: 'Ошибка',
                text: 'Произошла ошибка при попытке регистрации',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    });

    const buildingInfo = document.getElementById('building-info');
    const buildingTitle = document.getElementById('building-title');
    const buildingDescription = document.getElementById('building-description');
    const upgradeInfo = document.getElementById('upgrade-info');
    const upgradeButton = document.getElementById('upgrade-button');
    const closeBtn = document.querySelector('.close-btn');

    let currentBuilding = null;

    function showBuildingInfo(building) {
        currentBuilding = building;
        buildingTitle.textContent = building.type === 'sawmill' ? 'Лесопилка' : 'Шахта';
        buildingDescription.textContent = `Уровень: ${building.level}\nПроизводство: ${building.productionRate} ${building.type === 'sawmill' ? 'дерева' : 'руды'} в день`;

        const nextLevel = building.level + 1;
        if (nextLevel <= 3) {
            const upgradeCost = building.type === 'sawmill' ?
                BUILDING_LEVELS.sawmill[nextLevel].upgradeCost :
                BUILDING_LEVELS.mine[nextLevel].upgradeCost;

            upgradeInfo.innerHTML = `
                <ul>
                    <li>Следующий уровень: ${nextLevel}</li>
                    <li>Производство: ${building.type === 'sawmill' ? 
                        BUILDING_LEVELS.sawmill[nextLevel].productionRate : 
                        BUILDING_LEVELS.mine[nextLevel].productionRate} ${building.type === 'sawmill' ? 'дерева' : 'руды'} в день</li>
                    <li>Стоимость улучшения: ${upgradeCost} золота</li>
                </ul>
            `;

            upgradeButton.disabled = game.resources.gold < upgradeCost;
            upgradeButton.onclick = () => upgradeBuilding(building);
        } else {
            upgradeInfo.innerHTML = '<p>Максимальный уровень достигнут</p>';
            upgradeButton.disabled = true;
        }

        buildingInfo.style.display = 'block';
    }

    function upgradeBuilding(building) {
        const nextLevel = building.level + 1;
        const upgradeCost = building.type === 'sawmill' ?
            BUILDING_LEVELS.sawmill[nextLevel].upgradeCost :
            BUILDING_LEVELS.mine[nextLevel].upgradeCost;

        if (game.resources.gold >= upgradeCost) {
            game.resources.gold -= upgradeCost;
            building.level = nextLevel;
            building.productionRate = building.type === 'sawmill' ?
                BUILDING_LEVELS.sawmill[nextLevel].productionRate :
                BUILDING_LEVELS.mine[nextLevel].productionRate;

            updateResourcesDisplay();
            showBuildingInfo(building);
        }
    }

    closeBtn.onclick = () => {
        buildingInfo.style.display = 'none';
        currentBuilding = null;
    };

    window.onclick = (event) => {
        if (event.target === buildingInfo) {
            buildingInfo.style.display = 'none';
            currentBuilding = null;
        }
    };

    // Обновляем обработчик клика по зданиям
    function handleBuildingClick(building) {
        showBuildingInfo(building);
    }
});