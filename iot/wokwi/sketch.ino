/*
 * Marketplace Rural — Estação de monitoramento da fazenda (ESP32 no Wokwi)
 *
 * Sensores:
 *   DHT22 ............ temperatura e umidade do ar  -> GPIO 15
 *   LDR (módulo) ..... luminosidade (saída AO)      -> GPIO 34 (ADC1)
 *   Potenciômetro .... simula a umidade do solo     -> GPIO 35 (ADC1)
 *   (ADC1 porque o ADC2 do ESP32 não funciona com o Wi-Fi ligado.)
 *
 * Envio: a cada INTERVALO_MS publica um JSON no broker MQTT abaixo, no tópico
 *   marketplace-rural/dispositivos/<CODIGO_DISPOSITIVO>/leituras
 * A ponte local (iot/ponte-wokwi) assina esse tópico e grava as leituras na
 * API do marketplace (backend/iot/receber.php). O mesmo JSON sai no Serial.
 *
 * O código do dispositivo é o que o produtor informa em
 * Gestão da Fazenda > Conectar ESP32 para vinculá-lo ao seu perfil.
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include "DHTesp.h"

#define CODIGO_DISPOSITIVO "ESP32-MR-88CDA7"

const char* WIFI_SSID   = "Wokwi-GUEST";   // rede virtual do Wokwi (sem senha)
const char* WIFI_SENHA  = "";
// Broker público de testes do shiftr.io (usuário/senha "public" são os de demonstração
// divulgados por eles). A ponte local assina o mesmo broker por WebSocket seguro (443),
// que passa em redes que bloqueiam a porta 1883.
const char* MQTT_BROKER  = "public.cloud.shiftr.io";
const uint16_t MQTT_PORTA = 1883;
const char* MQTT_USUARIO = "public";
const char* MQTT_SENHA   = "public";
const char* TOPICO = "marketplace-rural/dispositivos/" CODIGO_DISPOSITIVO "/leituras";

const int PINO_DHT  = 15;
const int PINO_LDR  = 34;
const int PINO_SOLO = 35;

const unsigned long INTERVALO_MS = 5000;

// Curva do fotoresistor do Wokwi (LDR em série com 10 kΩ, alimentado em 3,3 V).
const float LDR_GAMMA = 0.7;
const float LDR_RL10  = 50;    // resistência (kΩ) a 10 lux
const float VCC       = 3.3;

DHTesp dht;
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long ultimoEnvio = 0;
unsigned long sequencia = 0;

void conectarWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Conectando ao Wi-Fi ");
  Serial.print(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_SENHA, 6);

  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }

  Serial.print(" conectado! IP: ");
  Serial.println(WiFi.localIP());
}

void conectarMqtt() {
  if (sequencia > 0) {
    Serial.print("MQTT desconectado (estado ");
    Serial.print(mqtt.state());
    Serial.println(")");
  }

  while (!mqtt.connected()) {
    String clientId = String(CODIGO_DISPOSITIVO) + "-" + String((uint32_t) esp_random(), HEX);
    Serial.print("Conectando ao broker MQTT ");
    Serial.print(MQTT_BROKER);
    Serial.print("... ");

    if (mqtt.connect(clientId.c_str(), MQTT_USUARIO, MQTT_SENHA)) {
      Serial.println("ok");
    } else {
      Serial.print("falhou (rc=");
      Serial.print(mqtt.state());
      Serial.println("), nova tentativa em 2 s");
      delay(2000);
    }
  }
}

float lerLuminosidadeLux() {
  float tensao = analogRead(PINO_LDR) / 4095.0 * VCC;

  if (tensao >= VCC - 0.001) return 0;        // escuro total
  if (tensao <= 0.001) return 100000;         // saturado (sol pleno)

  float resistencia = 10000.0 * tensao / (VCC - tensao);
  return pow(LDR_RL10 * 1e3 * pow(10, LDR_GAMMA) / resistencia, 1 / LDR_GAMMA);
}

float lerUmidadeSolo() {
  return analogRead(PINO_SOLO) / 4095.0 * 100.0;
}

void enviarLeituras() {
  TempAndHumidity ar = dht.getTempAndHumidity();

  if (dht.getStatus() != DHTesp::ERROR_NONE) {
    Serial.print("DHT22 com erro: ");
    Serial.println(dht.getStatusString());
    return;
  }

  float lux  = lerLuminosidadeLux();
  float solo = lerUmidadeSolo();

  char json[256];
  snprintf(json, sizeof(json),
           "{\"dispositivo\":\"%s\",\"seq\":%lu,\"temperatura\":%.1f,\"umidade_ar\":%.1f,"
           "\"luminosidade\":%.0f,\"umidade_solo\":%.1f}",
           CODIGO_DISPOSITIVO, ++sequencia, ar.temperature, ar.humidity, lux, solo);

  bool publicado = mqtt.publish(TOPICO, json);

  Serial.print(publicado ? "[MQTT ok] " : "[MQTT falhou] ");
  Serial.println(json);
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);

  Serial.println();
  Serial.println("Marketplace Rural - estacao de monitoramento");
  Serial.print("Codigo do dispositivo: ");
  Serial.println(CODIGO_DISPOSITIVO);

  dht.setup(PINO_DHT, DHTesp::DHT22);

  conectarWifi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORTA);
  mqtt.setBufferSize(512);
  // A simulação pode rodar mais devagar que o tempo real: keep-alive folgado
  // evita que o broker derrube a conexão entre um envio e outro.
  mqtt.setKeepAlive(120);
  mqtt.setSocketTimeout(30);
}

void loop() {
  conectarWifi();
  if (!mqtt.connected()) conectarMqtt();
  mqtt.loop();

  if (millis() - ultimoEnvio >= INTERVALO_MS || ultimoEnvio == 0) {
    ultimoEnvio = millis();
    enviarLeituras();
  }

  delay(10); // deixa a simulação mais rápida
}
