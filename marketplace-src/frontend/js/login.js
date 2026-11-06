document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('formLogin');
    const botoesPerfil = document.querySelectorAll('.perfil-btn');
    let perfil = 'produtor';

    function selecionarPerfil(valor) {
        perfil = valor;

        botoesPerfil.forEach((botao) => {
            botao.classList.toggle('ativo', botao.textContent.trim().toLowerCase() === valor);
        });
    }

    botoesPerfil.forEach((botao) => {
        botao.addEventListener('click', () => {
            selecionarPerfil(botao.textContent.trim().toLowerCase());
        });
    });

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(formLogin);
            formData.append('perfil', perfil);
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
                    window.location.href = 'inicio.html';
                } else {
                    // Perfil diferente do tipo da conta: já deixa o correto selecionado.
                    if (data.tipo_conta) {
                        selecionarPerfil(data.tipo_conta);
                    }

                    alert(data.mensagem);
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
