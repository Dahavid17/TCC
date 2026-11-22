document.addEventListener('DOMContentLoaded', () => {
    const formCadastro = document.getElementById('formCadastro');
    const mensagemForm = document.getElementById('mensagemCadastrar'); // Pega o parágrafo de alerta

    // Alternância Produtor/Comprador: atualiza o botão ativo e o input hidden
    const tipoInput = document.getElementById('tipoConta');
    document.querySelectorAll('.tipo-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tipo-btn').forEach((b) => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            tipoInput.value = btn.textContent.trim().toLowerCase();
        });
    });

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

                if (data.sucesso && data.precisa_verificar && window.VerificacaoEmail) {
                    // Conta criada: agora a pessoa digita o código que chegou no e-mail.
                    mensagemForm.style.color = 'green';
                    mensagemForm.textContent = 'Conta criada! Falta só confirmar o e-mail.';
                    btnSubmit.textContent = 'Conta criada';
                    VerificacaoEmail.abrir({
                        email: data.email,
                        etapa: 'codigo',
                        mensagem: data.codigo_enviado ? 'Conta criada! Agora é só digitar o código.' : data.mensagem,
                        codigoEnviado: data.codigo_enviado,
                    });
                } else if (data.sucesso) {
                    mensagemForm.style.color = 'green';
                    mensagemForm.textContent = data.mensagem + " Redirecionando para o login...";
                    setTimeout(() => {
                        window.location.href = 'login-marketplace.html';
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