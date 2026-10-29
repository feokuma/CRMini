// Parada única do servidor Next, compartilhada entre fechar a janela
// (`before-quit`) e instalar atualização (`beforeInstall`). As duas rotas podem
// acontecer quase juntas: sem esta guarda, a segunda chegaria com o servidor já
// parado (ou com a parada em andamento) e iniciaria outra tentativa.
function createServerShutdown({ stop, logger = console }) {
  let pending;
  let stopped = false;

  function stopOnce() {
    // Já parado: não há o que encerrar de novo.
    if (stopped) return Promise.resolve();
    // Quem chega durante uma parada reaproveita a mesma promessa em vez de
    // disparar outra; assim as duas rotas esperam o mesmo encerramento.
    if (pending) {
      logger.debug?.("Parada do servidor já em andamento; aguardando a mesma.");
      return pending;
    }
    // `Promise.resolve().then(stop)` normaliza uma exceção síncrona de `stop()`
    // em rejeição tratada, sem quebrar quem chamou.
    const attempt = Promise.resolve()
      .then(() => stop())
      .then(
        () => {
          // Só conta como parado depois que `stop()` realmente resolve.
          stopped = true;
          pending = undefined;
        },
        (error) => {
          // Falha não marca `stopped`: descarta a promessa para permitir nova
          // tentativa (a instalação abortada deixa o app aberto) e propaga.
          pending = undefined;
          throw error;
        },
      );
    pending = attempt;
    return attempt;
  }

  function reset() {
    // Usado quando o servidor é reiniciado após falha de instalação: a janela
    // volta a funcionar e uma nova saída precisa pará-lo de novo.
    stopped = false;
  }

  return {
    stopOnce,
    reset,
    get stopped() {
      return stopped;
    },
  };
}

module.exports = { createServerShutdown };
