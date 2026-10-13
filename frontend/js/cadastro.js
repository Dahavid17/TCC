document.addEventListener('DOMContentLoaded', () => {
    const formCadastro = document.getElementById('formCadastro');
    const mensagemForm = document.getElementById('mensagemCadastrar'); // Pega o parágrafo de alerta

    if (formCadastro) {
        formCadastro.addEventListener('submit', async (e) => {
            e.preventDefault(); // Impede o redirecionamento padrão do HTML
            
            // Pega os dados do formulário
            const formData = new FormData(formCadastro);
            
            // Como o input hidden não tem o atributo "name" no HTML, forçamos a inclusão dele aqui:
            const tipoConta = document.getElementById('tipoConta').value;
            formData.append('tipoConta', tipoConta);

            try {
                // Desabilita o botão para evitar múltiplos envios
                const btnSubmit = document.getElementById('cadastrar');
                btnSubmit.disabled = true;
                btnSubmit.textContent = 'Cadastrando...';

                // Envia para o backend
                const response = await fetch(formCadastro.action, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.sucesso) {
                    mensagemForm.style.color = 'green';
                    mensagemForm.textContent = data.mensagem + " Redirecionando para o login...";
                    // Redireciona após 2 segundos
                    setTimeout(() => {
                        window.location.href = 'inicio.html';
                    }, 2000);
                } else {
                    mensagemForm.style.color = 'red';
                    mensagemForm.textContent = data.mensagem;
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Cadastrar';
                }
            } catch (error) {
                mensagemForm.style.color = 'red';
                mensagemForm.textContent = 'Erro ao conectar com o servidor.';
                console.error('Erro:', error);
            }
        });
    }
});