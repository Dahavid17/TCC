document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('formLogin');

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault(); 

            const formData = new FormData(formLogin);
            const btnSubmit = formLogin.querySelector('.btn-login');

            try {
                btnSubmit.disabled = true;
                btnSubmit.textContent = 'Entrando...';

                const response = await fetch(formLogin.action, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.sucesso) {
                    // Login bem-sucedido, redireciona o usuário para o painel
                    window.location.href = data.redirect;
                } else {
                    alert(data.mensagem); // Mostra o erro em um alert (ou você pode criar um <p> na tela como no cadastro)
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Entrar na plataforma';
                }
            } catch (error) {
                alert('Erro ao conectar com o servidor.');
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Entrar na plataforma';
                console.error('Erro:', error);
            }
        });
    }
});