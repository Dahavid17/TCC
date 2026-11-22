// Janela "Confirme seu e-mail", usada no login e no cadastro.
// Só e-mails reais entram: enviamos um código de 6 números e a pessoa digita aqui.
// Backend: backend/auth/enviar_codigo.php e backend/auth/confirmar_email.php.
//
// Uso:
//   VerificacaoEmail.abrir({ email: 'maria@gmail.com', etapa: 'enviar' });   // login: pergunta antes de enviar
//   VerificacaoEmail.abrir({ email, etapa: 'codigo', mensagem: '...' });     // cadastro: código já foi enviado

(function () {
    const API = '../../backend/auth/';
    const ESPERA_REENVIO = 60;

    let fundo = null;
    let emailAtual = '';
    let relogio = null;

    function el(html) {
        const t = document.createElement('template');
        t.innerHTML = html.trim();
        return t.content.firstElementChild;
    }

    async function chamar(arquivo, dados) {
        const corpo = new FormData();
        Object.entries(dados).forEach(([k, v]) => corpo.append(k, v));

        try {
            const resposta = await fetch(API + arquivo, { method: 'POST', body: corpo, credentials: 'same-origin' });
            return await resposta.json();
        } catch (erro) {
            return { sucesso: false, mensagem: 'Sem conexão com o servidor. Confira a internet e tente de novo.' };
        }
    }

    function mostrarMensagem(texto, tipo) {
        const m = fundo.querySelector('.verif-mensagem');
        m.textContent = texto || '';
        m.className = 'verif-mensagem' + (tipo ? ' ' + tipo : '');
    }

    function irPara(etapa) {
        fundo.querySelectorAll('.verif-etapa').forEach((e) => { e.hidden = e.dataset.etapa !== etapa; });

        // O aviso (erro/sucesso) fica logo abaixo do campo da etapa, onde a pessoa está olhando.
        const campo = fundo.querySelector(`.verif-etapa[data-etapa="${etapa}"] .verif-campo`);
        campo.insertAdjacentElement('afterend', fundo.querySelector('.verif-mensagem'));
        fundo.querySelector('.verif-email-atual').textContent = emailAtual;
        fundo.querySelector('#verifEmail').value = emailAtual;

        const foco = etapa === 'codigo' ? '#verifCodigo' : '#verifEmail';
        setTimeout(() => fundo.querySelector(foco).focus(), 50);
    }

    function contarReenvio(segundos) {
        const botao = fundo.querySelector('#verifReenviar');
        clearInterval(relogio);

        const atualizar = () => {
            botao.disabled = segundos > 0;
            botao.innerHTML = segundos > 0
                ? `<i class="bi bi-hourglass-split"></i> Reenviar em ${segundos}s`
                : '<i class="bi bi-arrow-repeat"></i> Reenviar código';
            if (segundos-- <= 0) clearInterval(relogio);
        };

        atualizar();
        relogio = setInterval(atualizar, 1000);
    }

    async function enviarCodigo(email) {
        const botao = fundo.querySelector('#verifEnviar');
        botao.disabled = true;
        mostrarMensagem('Enviando o código...', '');

        const r = await chamar('enviar_codigo.php', { email });
        botao.disabled = false;

        if (!r.sucesso) {
            mostrarMensagem(r.mensagem, 'erro');
            // Já está na tela do código (reenviar): continua nela.
            return false;
        }

        emailAtual = r.email || email;
        irPara('codigo');
        mostrarMensagem(r.mensagem, 'ok');
        contarReenvio(ESPERA_REENVIO);
        return true;
    }

    async function confirmar() {
        const campo = fundo.querySelector('#verifCodigo');
        const codigo = campo.value.replace(/\D/g, '');

        if (codigo.length !== 6) {
            mostrarMensagem('Digite os 6 números do código.', 'erro');
            campo.focus();
            return;
        }

        const botao = fundo.querySelector('#verifConfirmar');
        botao.disabled = true;
        mostrarMensagem('Conferindo...', '');

        const r = await chamar('confirmar_email.php', { codigo });

        if (r.sucesso) {
            mostrarMensagem('E-mail confirmado! Entrando...', 'ok');
            window.location.href = r.redirect || 'inicio.html';
            return;
        }

        botao.disabled = false;
        mostrarMensagem(r.mensagem, 'erro');
        campo.select();
    }

    function montar() {
        fundo = el(`
            <div class="verif-fundo" role="dialog" aria-modal="true" aria-labelledby="verifTitulo">
              <div class="verif-caixa">
                <div class="verif-icone"><i class="bi bi-envelope-check"></i></div>
                <h2 id="verifTitulo">Confirme seu e-mail</h2>

                <div class="verif-etapa" data-etapa="enviar">
                  <p class="verif-texto">Para usar o MarketPlace Rural, seu e-mail precisa ser <strong>real</strong>. Vamos mandar um código de 6 números para ele.</p>
                  <label class="verif-rotulo" for="verifEmail">Seu e-mail</label>
                  <input class="verif-campo" id="verifEmail" type="email" autocomplete="email" inputmode="email" placeholder="nome@gmail.com">
                  <p class="verif-ajuda">Se este e-mail estiver errado ou não existir, troque aqui por um e-mail que você consegue abrir.</p>
                  <button type="button" class="verif-btn" id="verifEnviar"><i class="bi bi-send"></i> Enviar código</button>
                </div>

                <div class="verif-etapa" data-etapa="codigo" hidden>
                  <p class="verif-texto">Enviamos um código para<br><strong class="verif-email-atual"></strong></p>
                  <label class="verif-rotulo" for="verifCodigo">Código de 6 números</label>
                  <input class="verif-campo verif-codigo" id="verifCodigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">
                  <button type="button" class="verif-btn" id="verifConfirmar"><i class="bi bi-check-lg"></i> Confirmar</button>
                  <button type="button" class="verif-btn secundario" id="verifReenviar"><i class="bi bi-arrow-repeat"></i> Reenviar código</button>
                  <p class="verif-dica"><i class="bi bi-lightbulb"></i> Não chegou? Espere 1 minuto e olhe também a pasta <b>Spam</b> ou <b>Lixo eletrônico</b>.</p>
                  <button type="button" class="verif-link" id="verifTrocar">Usar outro e-mail</button>
                </div>

                <p class="verif-mensagem" role="status" aria-live="polite"></p>
                <button type="button" class="verif-link" id="verifFechar">Voltar</button>
              </div>
            </div>`);

        fundo.querySelector('#verifEnviar').addEventListener('click', () => {
            const email = fundo.querySelector('#verifEmail').value.trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                mostrarMensagem('Digite um e-mail válido, como nome@gmail.com.', 'erro');
                return;
            }
            enviarCodigo(email);
        });

        fundo.querySelector('#verifEmail').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') fundo.querySelector('#verifEnviar').click();
        });

        const campoCodigo = fundo.querySelector('#verifCodigo');
        campoCodigo.addEventListener('input', () => {
            campoCodigo.value = campoCodigo.value.replace(/\D/g, '').slice(0, 6);
            if (campoCodigo.value.length === 6) confirmar(); // colou ou digitou tudo: já confere
        });
        campoCodigo.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmar(); });

        fundo.querySelector('#verifConfirmar').addEventListener('click', confirmar);
        fundo.querySelector('#verifReenviar').addEventListener('click', () => enviarCodigo(emailAtual));
        fundo.querySelector('#verifTrocar').addEventListener('click', () => { mostrarMensagem(''); irPara('enviar'); });
        fundo.querySelector('#verifFechar').addEventListener('click', fechar);
        fundo.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });

        document.body.appendChild(fundo);
    }

    function fechar() {
        clearInterval(relogio);
        if (fundo) fundo.remove();
        fundo = null;
    }

    window.VerificacaoEmail = {
        abrir({ email = '', etapa = 'enviar', mensagem = '', codigoEnviado = true } = {}) {
            fechar();
            montar();
            emailAtual = email;
            irPara(etapa);

            if (mensagem) mostrarMensagem(mensagem, etapa === 'codigo' && codigoEnviado ? 'ok' : (codigoEnviado ? '' : 'erro'));
            if (etapa === 'codigo') contarReenvio(codigoEnviado ? ESPERA_REENVIO : 0);
        },
        fechar,
    };
})();
