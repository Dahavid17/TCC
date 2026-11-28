-- 011: registra quando a pessoa aceitou os Termos de Uso e a Política de Privacidade (LGPD, art. 8º, §2º:
-- cabe ao controlador provar o consentimento). Rodar no phpMyAdmin ANTES de publicar backend/auth/cadastro.php
-- (o cadastro funciona mesmo sem esta migração, só não guarda a data do aceite).

ALTER TABLE usuarios
    ADD COLUMN termos_aceitos_em DATETIME NULL DEFAULT NULL,
    ADD COLUMN termos_versao VARCHAR(20) NULL DEFAULT NULL;

-- Para desfazer:
-- ALTER TABLE usuarios DROP COLUMN termos_aceitos_em, DROP COLUMN termos_versao;
