let timerId = null;
let timeRemaining = 0;

self.onmessage = function(e) {
    const { action, seconds } = e.data;
    
    if (action === 'start') {
        if (timerId) clearInterval(timerId);
        
        timeRemaining = seconds;
        self.postMessage({ type: 'tick', timeRemaining });
        
        timerId = setInterval(() => {
            timeRemaining--;
            self.postMessage({ type: 'tick', timeRemaining });
            
            if (timeRemaining <= 0) {
                clearInterval(timerId);
                timerId = null;
                self.postMessage({ type: 'complete' });
            }
        }, 1000);
    } else if (action === 'stop') {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    } else if (action === 'add') {
        timeRemaining += seconds;
        self.postMessage({ type: 'tick', timeRemaining });
    }
};
