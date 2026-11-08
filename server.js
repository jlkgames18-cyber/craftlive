      // تحويل رابط الـ HTTP الخاص برندر إلى بروتوكول الـ WebSocket الآمن (wss)
      const renderUrl = "your-app.onrender.com"; // ضع رابط السيرفر الخاص بك هنا بدون https
      const brokerUrl = `wss://${renderUrl}`;
      socket = new WebSocket(brokerUrl);
      
      socket.onopen = async () => {
        // تسجيل الدخول في الغرفة المحددة فور فتح الاتصال
        socket.send(JSON.stringify({ type: 'join', room: roomCode }));

        if (isHost) {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          socket.send(JSON.stringify({ offer: offer }));
        }
      };

      socket.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);

        if (data.offer && !isHost) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.send(JSON.stringify({ answer: answer }));
        }
        
        if (data.answer && isHost) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        
        if (data.ice) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.ice));
          } catch(e) { console.error(e); }
        }
      };
