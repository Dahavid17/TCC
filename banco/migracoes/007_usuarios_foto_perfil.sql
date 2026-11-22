-- Foto de perfil do usuário (Configurações > Perfil > Alterar foto).
-- Caminho relativo à raiz do site, ex.: uploads/perfis/<32 hex>.jpg; NULL = mostra a inicial do nome.
-- backend/usuarios/foto.php também cria esta coluna sozinho se ela ainda não existir.

ALTER TABLE usuarios
  ADD COLUMN foto_perfil VARCHAR(255) NULL DEFAULT NULL;
