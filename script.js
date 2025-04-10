document.addEventListener('DOMContentLoaded', function() {
    // Theme toggling
    const themeSwitch = document.getElementById('theme-switch');
    
    themeSwitch.addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            localStorage.setItem('theme', 'light');
        }
    });
    
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        themeSwitch.checked = false;
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    }
    
    // Description toggle functionality - descriptions start expanded by default
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Toggle active class on button
            this.classList.toggle('active');
            
            // Toggle active class on content
            const content = this.nextElementSibling;
            content.classList.toggle('active');
            
            // Update icon based on state
            const icon = this.querySelector('i');
            if (this.classList.contains('active')) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
                content.style.maxHeight = '200px';
            } else {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
                content.style.maxHeight = '0px';
            }
        });
    });
    
    // Animation for cards
    const versionCards = document.querySelectorAll('.version-card');
    
    // Add a small delay between each card animation
    versionCards.forEach((card, index) => {
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 150);
    });
    
    // Add animation to cards initially
    document.querySelectorAll('.version-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    });
}); 