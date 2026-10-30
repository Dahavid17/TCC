// Adiciona "Gestão da Fazenda" ao menu lateral (acima de Configurações) só para produtores/administradores.
// A autorização real fica no backend (backend/gestao/resumo.php); aqui é apenas navegação.
(async () => {

    const configuracoes = document.querySelector('.sidebar a[href="configuracoes.html"]');

    if (!configuracoes || document.querySelector('.sidebar a[href="gestao-fazenda.html"]')) {
        return;
    }

    try {

        const resposta = await fetch("../../backend/auth/sessao.php");
        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso || !["produtor", "admin"].includes(dados.usuario.tipo_acesso)) {
            return;
        }

        const link = document.createElement("a");
        link.href = "gestao-fazenda.html";
        link.innerHTML = '<i class="bi bi-tree"></i><span>Gestão da Fazenda</span>';

        configuracoes.before(link);

    } catch (erro) {

        console.error("Menu: não foi possível verificar o perfil", erro);
    }

})();
