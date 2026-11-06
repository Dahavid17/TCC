<?php
// Banco do ambiente LOCAL (instância MySQL de testes criada por dev/iniciar-local.ps1).
// Usado só quando MARKETPLACE_CONFIG aponta para este arquivo (dev/router.php faz isso).
return [
    'host'    => '127.0.0.1',
    'porta'   => '3307',
    'dbname'  => 'marketplace_rural_dev',
    'usuario' => 'root',
    'senha'   => '',
];
