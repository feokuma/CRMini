const greetings = {
  morning: [
    "Bom dia", "Que bom ter você por aqui", "Um ótimo começo de dia", "Comece o dia com boas ideias",
    "Que seu dia seja produtivo", "Um dia cheio de conquistas para você", "A paz de Cristo", "Que Deus abençoe seu dia",
    "Que a graça de Deus acompanhe seu dia", "Que o Senhor ilumine seus caminhos", "Bom dia, na paz do Senhor", "Que Deus renove suas forças nesta manhã",
  ],
  afternoon: [
    "Boa tarde", "Espero que sua tarde esteja indo bem", "Uma excelente tarde para você", "Vamos fazer desta tarde um sucesso",
    "Que sua tarde renda bons frutos", "Uma tarde de boas realizações", "A paz de Cristo", "Que Deus abençoe sua tarde",
    "Que a graça de Deus esteja com você nesta tarde", "Que o Senhor conduza sua tarde", "Boa tarde, na paz do Senhor", "Que Deus renove suas forças nesta tarde",
  ],
  evening: [
    "Boa noite", "Que sua noite seja tranquila", "Uma ótima noite para você", "Que seu dia termine muito bem",
    "Desacelere e aproveite sua noite", "Uma noite de paz e descanso", "A paz de Cristo", "Que Deus abençoe sua noite",
    "Que a paz de Deus esteja com você", "Que o Senhor guarde sua noite", "Boa noite, na paz do Senhor", "Que Deus lhe conceda uma noite serena",
  ],
};

export function getGreeting(date = new Date(), name = "Djardi") {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo",
    year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  const hour = get("hour");
  const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const dayKey = get("year") * 10000 + get("month") * 100 + get("day");
  const options = greetings[period];
  return `${options[dayKey % options.length]}, ${name}`;
}

export function getDashboardDate(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(date).toLocaleUpperCase("pt-BR");
}
