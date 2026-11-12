// Preferências do usuário (tour já visto, plano escolhido...).
// Ficam no servidor (backend/usuarios/preferencias.php), então valem em qualquer navegador
// ou computador. Uma cópia fica no navegador para responder rápido e para o caso de o
// servidor estar fora do ar.
//
//   await PreferenciasUsuario.carregar(usuario);   // uma vez por página, depois da sessão
//   PreferenciasUsuario.obter("plano");             // "essencial" | "pro" | null
//   await PreferenciasUsuario.definir("plano", "pro");
//   await PreferenciasUsuario.definir("plano", null);  // apaga

window.PreferenciasUsuario = (function () {

    const API = "../../backend/usuarios/preferencias.php";

    let usuarioId = null;
    let doServidor = {};
    let carregando = null;

    function chaveLocal(chave) {
        return `marketplace:pref:${usuarioId}:${chave}`;
    }

    function lerLocal(chave) {
        try {
            return localStorage.getItem(chaveLocal(chave));
        } catch (erro) {
            return null;
        }
    }

    function gravarLocal(chave, valor) {
        try {
            if (valor === null) localStorage.removeItem(chaveLocal(chave));
            else localStorage.setItem(chaveLocal(chave), valor);
        } catch (erro) {
            // Navegador sem armazenamento (aba anônima): vale só o servidor.
        }
    }

    async function enviar(chave, valor) {
        try {
            await fetch(API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chave, valor })
            });
        } catch (erro) {
            console.warn("Preferência guardada só neste navegador:", chave, erro);
        }
    }

    function carregar(usuario) {

        if (!usuario?.id) return Promise.resolve();
        if (usuarioId === usuario.id && carregando) return carregando;

        usuarioId = usuario.id;

        carregando = (async () => {
            try {
                const resposta = await fetch(API);
                const dados = await resposta.json();

                if (resposta.ok && dados.sucesso) {
                    doServidor = dados.preferencias || {};

                    // O servidor é a referência: atualiza a cópia local.
                    Object.entries(doServidor).forEach(([chave, valor]) => gravarLocal(chave, valor));
                }
            } catch (erro) {
                console.warn("Preferências: usando a cópia do navegador.", erro);
            }
        })();

        return carregando;
    }

    function obter(chave) {
        return doServidor[chave] ?? lerLocal(chave);
    }

    async function definir(chave, valor) {

        if (valor === null) delete doServidor[chave];
        else doServidor[chave] = valor;

        gravarLocal(chave, valor);
        await enviar(chave, valor);
    }

    return { carregar, obter, definir };

})();
