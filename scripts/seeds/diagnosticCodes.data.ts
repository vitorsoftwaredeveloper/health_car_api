import { DiagnosticCodeDocument } from "../../src/types/diagnostics";

export const diagnosticCodesSeed: Omit<
  DiagnosticCodeDocument,
  "_id" | "createdAt" | "updatedAt"
>[] = [
  {
    code: "P0080",
    title: "Circuito do solenoide de controle de válvula de escape",
    explanation:
      "A central mandou um comando para o solenoide que controla a válvula de escape e leu tensão alta demais no circuito, o que normalmente significa fio partido, mau contato ou o próprio solenoide aberto. Como falha elétrica, costuma aparecer e sumir conforme a vibração do carro.",
    severity: "watch",
    drivable: true,
    likelyCauses: [
      "conector solto ou oxidado no solenoide",
      "chicote rompido ou esfregando na carroceria",
      "solenoide da válvula de escape queimado",
    ],
    catalogItemCode: null,
    active: true,
  },
  {
    code: "P0300",
    title: "Falha de combustão em cilindro não identificado",
    explanation:
      "A central percebeu que a queima falhou em mais de um cilindro. Falha de combustão joga combustível não queimado no escapamento e destrói o catalisador, que é a peça mais cara do sistema de emissões.",
    severity: "soon",
    drivable: true,
    likelyCauses: [
      "velas de ignição no fim da vida",
      "bobina ou cabo de vela com fuga",
      "filtro de combustível entupido",
      "entrada de ar falsa no coletor",
    ],
    catalogItemCode: "SPARK_PLUGS",
    active: true,
  },
  {
    code: "P0301",
    title: "Falha de combustão no cilindro 1",
    explanation:
      "A queima falhou repetidamente no primeiro cilindro. Se a luz de injeção estiver piscando, é falha destruindo o catalisador naquele momento: encoste e desligue.",
    severity: "soon",
    drivable: true,
    likelyCauses: [
      "vela do cilindro 1 gasta",
      "bobina do cilindro 1 com falha",
      "bico injetor entupido",
      "baixa compressão nesse cilindro",
    ],
    catalogItemCode: "SPARK_PLUGS",
    active: true,
  },
  {
    code: "P0171",
    title: "Mistura pobre demais no banco 1",
    explanation:
      "Está entrando mais ar do que a central esperava, ou chegando menos combustível. Ela compensa injetando mais, e por isso o ajuste de combustível longo sobe. Mistura pobre esquenta a câmara e, mantida por muito tempo, danifica válvula e catalisador.",
    severity: "soon",
    drivable: true,
    likelyCauses: [
      "entrada de ar falsa em mangueira ou junta do coletor",
      "filtro de ar saturado",
      "sonda lambda cansada",
      "bomba ou filtro de combustível fracos",
    ],
    catalogItemCode: "AIR_FILTER",
    active: true,
  },
  {
    code: "P0172",
    title: "Mistura rica demais no banco 1",
    explanation:
      "Está chegando mais combustível do que o necessário. Consumo sobe, o escapamento cheira a combustível e o excesso vai lavando o óleo do motor pelas paredes do cilindro.",
    severity: "soon",
    drivable: true,
    likelyCauses: [
      "bico injetor vazando",
      "sensor de temperatura do motor mentindo",
      "filtro de ar entupido",
      "regulador de pressão de combustível com defeito",
    ],
    catalogItemCode: "FUEL_FILTER",
    active: true,
  },
  {
    code: "P0420",
    title: "Eficiência do catalisador abaixo do limite",
    explanation:
      "A central compara as duas sondas lambda e concluiu que o catalisador não está mais limpando o gás como deveria. Antes de trocar a peça, vale confirmar que as sondas estão boas, porque sonda velha faz o catalisador parecer culpado.",
    severity: "soon",
    drivable: true,
    likelyCauses: [
      "catalisador saturado pelo tempo de uso",
      "sonda lambda traseira cansada",
      "falha de combustão antiga que danificou o catalisador",
      "vazamento no escapamento antes do catalisador",
    ],
    catalogItemCode: null,
    active: true,
  },
  {
    code: "P0135",
    title: "Aquecimento da sonda lambda 1 com defeito",
    explanation:
      "A sonda precisa estar quente para medir. O aquecedor dela não está funcionando, então o carro demora a entrar em malha fechada e gasta mais nos primeiros minutos.",
    severity: "watch",
    drivable: true,
    likelyCauses: [
      "resistência de aquecimento da sonda queimada",
      "fusível ou relé do circuito de aquecimento",
      "conector da sonda oxidado",
    ],
    catalogItemCode: null,
    active: true,
  },
  {
    code: "P0130",
    title: "Circuito da sonda lambda 1 fora de faixa",
    explanation:
      "O sinal da sonda dianteira não está oscilando como deveria. Sem essa leitura, a central passa a dosar combustível por tabela, o que aumenta consumo sem acender nada no painel além desta falha.",
    severity: "soon",
    drivable: true,
    likelyCauses: [
      "sonda lambda no fim da vida",
      "chicote da sonda rompido",
      "entrada de ar falsa no escapamento",
    ],
    catalogItemCode: null,
    active: true,
  },
  {
    code: "P0128",
    title: "Motor não atinge a temperatura de trabalho",
    explanation:
      "O motor demora demais para aquecer, quase sempre porque a válvula termostática ficou aberta. Motor frio gasta mais combustível e desgasta mais rápido, mesmo sem parecer que há defeito.",
    severity: "watch",
    drivable: true,
    likelyCauses: [
      "válvula termostática travada aberta",
      "sensor de temperatura do motor descalibrado",
    ],
    catalogItemCode: null,
    active: true,
  },
  {
    code: "P0217",
    title: "Superaquecimento do motor",
    explanation:
      "A central registrou temperatura acima do que o motor suporta. Isso é dano em curso: junta de cabeçote, cabeçote empenado e motor fundido começam assim.",
    severity: "stop",
    drivable: false,
    likelyCauses: [
      "falta de líquido de arrefecimento",
      "ventoinha do radiador parada",
      "bomba d'água com defeito",
      "radiador entupido",
    ],
    catalogItemCode: "COOLANT",
    active: true,
  },
  {
    code: "P0562",
    title: "Tensão do sistema elétrico baixa",
    explanation:
      "A central mediu tensão abaixo do necessário para o carro funcionar direito. Além do risco de não dar partida, tensão baixa faz módulos se comportarem de forma imprevisível.",
    severity: "soon",
    drivable: true,
    likelyCauses: [
      "alternador não carregando",
      "correia do alternador frouxa",
      "bateria no fim da vida",
      "borne de bateria oxidado",
    ],
    catalogItemCode: "BATTERY",
    active: true,
  },
  {
    code: "P0563",
    title: "Tensão do sistema elétrico alta",
    explanation:
      "A tensão está acima do esperado, o que cozinha a bateria por dentro e queima lâmpadas e módulos com o tempo. Quase sempre é o regulador do alternador.",
    severity: "soon",
    drivable: true,
    likelyCauses: [
      "regulador de tensão do alternador com defeito",
      "aterramento do motor com mau contato",
    ],
    catalogItemCode: "BATTERY",
    active: true,
  },
  {
    code: "P0442",
    title: "Vazamento pequeno no sistema evaporativo",
    explanation:
      "O sistema que impede o vapor de combustível de escapar do tanque perdeu vedação. Não afeta como o carro anda, mas reprova em inspeção e faz cheiro de combustível aparecer.",
    severity: "watch",
    drivable: true,
    likelyCauses: [
      "tampa do tanque mal fechada ou com borracha ressecada",
      "mangueira do canister rachada",
      "válvula de purga presa",
    ],
    catalogItemCode: null,
    active: true,
  },
];
