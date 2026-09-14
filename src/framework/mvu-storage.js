(function () {
  window.createMvuWriter = function (save, settled) {
    let epoch = 0;
    let pending = null;
    let writing = false;
    async function drain() {
      if (writing) return;
      writing = true;
      while (pending) {
        const item = pending;
        pending = null;
        try {
          await save(item.data);
          if (item.epoch === epoch) settled(null);
        } catch (error) {
          if (item.epoch === epoch) settled(error);
        }
      }
      writing = false;
    }
    return {
      write(data) {
        pending = { epoch, data: JSON.parse(JSON.stringify(data)) };
        void drain();
      },
      reset() { epoch++; pending = null; },
    };
  };
})();
