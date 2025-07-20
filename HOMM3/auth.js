document.addEventListener('DOMContentLoaded', () => {
    // Обработка переключения вкладок
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            // Убираем активный класс у всех кнопок и контента
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Добавляем активный класс выбранной кнопке и контенту
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Обработка формы входа
    const loginForm = document.getElementById('loginForm');
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
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('username', username);
                window.location.href = 'menu.html';
            } else {
                alert('Ошибка входа: ' + data.message);
            }
        } catch (error) {
            console.error('Ошибка при входе:', error);
            alert('Произошла ошибка при входе');
        }
    });

    // Обработка формы регистрации
    const registerForm = document.getElementById('registerForm');
    registerForm.addEventListener('submit', async(e) => {
        e.preventDefault();

        const username = document.getElementById('registerUsername').value;
        const password = document.getElementById('registerPassword').value;

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
                alert('Регистрация успешна! Теперь вы можете войти.');
                // Переключаемся на вкладку входа
                document.querySelector('[data-tab="login"]').click();
            } else {
                alert('Ошибка регистрации: ' + data.message);
            }
        } catch (error) {
            console.error('Ошибка при регистрации:', error);
            alert('Произошла ошибка при регистрации');
        }
    });
});