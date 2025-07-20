document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, авторизован ли пользователь
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    
    if (!userId || !username) {
        // Если пользователь не авторизован, перенаправляем на страницу входа
        window.location.href = 'index.html';
        return;
    }
    
    // Отображаем имя пользователя
    const playerNameElement = document.getElementById('menuPlayerName');
    if (playerNameElement) {
        playerNameElement.textContent = `Игрок: ${username}`;
    }
    
    // Обработчик для кнопки знакомства с игрой
    const tutorialBtn = document.getElementById('tutorialBtn');
    if (tutorialBtn) {
        tutorialBtn.addEventListener('click', () => {
            window.location.href = 'game.html';
        });
    }
    
    // Обработчик для кнопки выхода из аккаунта
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('http://localhost:8000/api', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'logout',
                        userId: userId
                    })
                });
                
                const data = await response.json();
                
                // В любом случае очищаем локальное хранилище и перенаправляем на страницу входа
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Ошибка при выходе:', error);
                // Всё равно очищаем хранилище и перенаправляем
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                window.location.href = 'index.html';
            }
        });
    }
}); 