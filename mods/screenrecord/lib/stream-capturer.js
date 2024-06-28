class StreamCapturer {
    constructor(app, logo) {
        this.combinedStream = null;
        this.streamData = [];
        this.app = app
        this.logo = logo
        this.handleResize = this.handleResize.bind(this);
        this.hasSeenVideo = {}
    }



    drawImageProp(ctx, img, x, y, w, h, offsetX, offsetY) {

        if (arguments.length === 2) {
            x = y = 0;
            w = ctx.canvas.width;
            h = ctx.canvas.height;
        }

        offsetX = typeof offsetX === "number" ? offsetX : 0.5;
        offsetY = typeof offsetY === "number" ? offsetY : 0.5;

        if (offsetX < 0) offsetX = 0;
        if (offsetY < 0) offsetY = 0;
        if (offsetX > 1) offsetX = 1;
        if (offsetY > 1) offsetY = 1;

        let iw = img.videoWidth || img.width,
            ih = img.videoHeight || img.height,
            r = Math.min(w / iw, h / ih),
            nw = iw * r,
            nh = ih * r,
            cx, cy, cw, ch, ar = 1;

        if (nw < w) ar = w / nw;
        if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;
        nw *= ar;
        nh *= ar;

        cw = iw / (nw / w);
        ch = ih / (nh / h);

        cx = (iw - cw) * offsetX;
        cy = (ih - ch) * offsetY;

        if (cx < 0) cx = 0;
        if (cy < 0) cy = 0;
        if (cw > iw) cw = iw;
        if (ch > ih) ch = ih;

        ctx.drawImage(img, cx, cy, cw, ch, x, y, w, h);
        this.drawLogoOnCanvas(ctx)
    }


    drawLogoOnCanvas(ctx) {
        const maxDimension = 100;
        const aspectRatio = this.logo.naturalWidth / this.logo.naturalHeight;
        let logoWidth, logoHeight;
        if (this.logo.naturalWidth > this.logo.naturalHeight) {
            logoWidth = maxDimension;
            logoHeight = maxDimension / aspectRatio;
        } else {
            logoHeight = maxDimension;
            logoWidth = maxDimension * aspectRatio;
        }

        const logoX = ctx.canvas.width - logoWidth - 50;
        const logoY = ctx.canvas.height - logoHeight - 10;

        this.logo.style.objectFit = "cover";
        ctx.drawImage(this.logo, logoX, logoY, logoWidth, logoHeight);
    }



    resizeCanvas(canvas, drawStreamsToCanvas, self) {
        // console.log('resizing canvas')
        // console.log('resizing', self.name)
        // canvas.width = document.querySelector('.video-container-large').clientWidth;
        canvas.width = window.innerWidth
        canvas.height = document.querySelector('.video-container-large').clientHeight;
        const videoElements = document.querySelectorAll('div[id^="stream_"] video');
        // videoElements.forEach(video => {
        //     video.style.objectFit = "cover";
        //     video.style.width = "100%";
        //     video.style.height = "100%";
        //     video.style.maxWidth = "100%";
        // });
        // Update the drawing routine to handle the new canvas size
        drawStreamsToCanvas();
    };


    handleResize() {
        this.resizeCanvas(this.canvas, this.drawStreamsToCanvas, this);
    }


    captureVideoCallStreams(includeCamera = false) {

        try {
            this.combinedStream = new MediaStream();
            this.is_capturing_stream = true

            document.querySelectorAll('canvas').forEach(canvas => {
                canvas.parentElement.removeChild(document.querySelector('canvas'))
            })

            const audioCtx = new AudioContext();
            const destination = new MediaStreamAudioDestinationNode(audioCtx)

            const processStream = (stream, type = "1") => {
                console.log('processing new stream', stream)
                if (stream && stream.getAudioTracks().length > 0) {
                    const source = new MediaStreamAudioSourceNode(audioCtx, { mediaStream: stream })
                    source.connect(destination);
                    console.log('processing new stream', stream)
                }


                return stream;
            };


            // let self = this
            if (includeCamera) {
                let observer = new MutationObserver((mutations) => {
                    let self = this
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList') {
                            mutation.addedNodes.forEach(node => {
                                if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'DIV' && node.id.startsWith('stream_')) {
                                    const videos = node.querySelectorAll('video');

                                    videos.forEach(video => {
                                        console.log(this.hasSeenVideo[video.id])
                                        if (this.hasSeenVideo[video.id]) return;
                                        // this.hasSeenVideo[video.id] = true
                                        console.log('new video element', video)
                                        const stream = 'captureStream' in video ? video.captureStream() : ('mozCaptureStream' in video ? video.mozCaptureStream() : null);
                                        processStream(stream, "2")
                                        // this.combinedStream = new MediaStream([destination.stream.getAudioTracks()[0], this.combinedStream.getVideoTracks()[0]])
                                        // this.emitUpdatedCombinedStream(this.combinedStream)               
                                        const rect = video.getBoundingClientRect();
                                        const parentID = video.parentElement.id;
                                        const videoElement = document.createElement('video');
                                        videoElement.srcObject = stream;
                                        videoElement.muted = true;
                                        videoElement.play();
                                        this.streamData.push({ stream, rect, parentID, videoElement });
                                    });
                                }
                            });
                        }
                        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                            this.streamData.forEach(data => {
                                if (data.parentID === mutation.target.id) {
                                    data.rect = mutation.target.getBoundingClientRect();
                                }
                            });

                        }
                        if (mutation.removedNodes.length > 0) {
                            mutation.removedNodes.forEach(node => {
                                let index = this.streamData.findIndex(data => data.videoElement === node || data.videoElement.parentElement === node);
                                if (index !== -1) {
                                    this.streamData.splice(index, 1);
                                }
                            });
                        }
                    });
                });
                observer.observe(document.body, {
                    attributes: true,
                    childList: true,
                    subtree: true,
                    attributeFilter: ['style']
                });
                const canvas = document.createElement('canvas');
                this.canvas = canvas
                canvas.width = window.innerWidth
                canvas.height = document.querySelector('.video-container-large').clientHeight;
                const ctx = canvas.getContext('2d');
                const drawStreamsToCanvas = () => {
                    if (!this.is_capturing_stream) return;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    this.streamData.forEach(data => {
                        const parentElement = document.getElementById(data.parentID);
                        if (!parentElement) return;
                        const rect = parentElement.getBoundingClientRect();
                        // Draw the video on the canvas
                        if (data.videoElement.readyState >= 2) {
                            this.drawImageProp(ctx, data.videoElement, rect.left, rect.top, rect.width, rect.height)
                        }
                    });
                    // console.log('still drawing streams');
                    this.animationFrameId = requestAnimationFrame(drawStreamsToCanvas);
                };

                this.drawStreamsToCanvas = drawStreamsToCanvas


                let self = this
                window.addEventListener('resize', this.handleResize);
                this.resizeCanvas(canvas, drawStreamsToCanvas, self);



                const videoElements = document.querySelectorAll('div[id^="stream_"] video');
                this.streamData = Array.from(videoElements).map(video => {
                    let stream = 'captureStream' in video ? video.captureStream() : ('mozCaptureStream' in video ? video.mozCaptureStream() : null);
                    processStream(stream)
                    this.hasSeenVideo[video.id] = true
                    const rect = video.getBoundingClientRect();
                    const parentID = video.parentElement.id;
                    const videoElement = document.createElement('video');
                    videoElement.srcObject = stream;
                    videoElement.muted = true;
                    videoElement.play();
                    videoElement.style.display = "none";
                    return { stream, rect, parentID, videoElement };
                }).filter(data => data.stream !== null);
                this.combinedStream.addTrack(canvas.captureStream(25).getVideoTracks()[0]);
            }

            else {
                let observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList') {
                            mutation.addedNodes.forEach(node => {
                                if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'DIV' && node.id.startsWith('stream_')) {
                                    const videos = node.querySelectorAll('video');
                                    videos.forEach(video => {
                                        const stream = 'captureStream' in video ? video.captureStream() : ('mozCaptureStream' in video ? video.mozCaptureStream() : null);
                                        processStream(stream)
                                    });
                                }
                            });
                        }
                        if (mutation.removedNodes.length > 0) {
                            mutation.removedNodes.forEach(node => {
                                let index = this.streamData.findIndex(data => data.videoElement === node || data.videoElement.parentElement === node);
                                if (index !== -1) {
                                    this.streamData.splice(index, 1);
                                }
                            });
                        }
                    });
                });
                observer.observe(document.body, {
                    attributes: true,
                    childList: true,
                    subtree: true,
                    attributeFilter: ['style']
                });
                document.querySelectorAll('video').forEach(video => {
                    let stream = 'captureStream' in video ? video.captureStream() : ('mozCaptureStream' in video ? video.mozCaptureStream() : null);
                    processStream(stream);
                });
            }
            this.combinedStream = new MediaStream([destination.stream.getAudioTracks()[0], this.combinedStream.getVideoTracks()[0]])
            return this.combinedStream;

        } catch (error) {
            console.log("Error capturing video streams", error)
            throw error
        }


    }



    stopCaptureVideoCallStreams() {
        this.is_capturing_stream = false
        cancelAnimationFrame(this.animationFrameId)
        // console.log('removing event listener')
        window.removeEventListener('resize', this.handleResize)
        this.combinedStream.getTracks().forEach(track => {
            track.stop()
            console.log(track, "track")

        })
        this.combinedStream = null

    }

    emitUpdatedCombinedStream() {
        this.app.connection.emit('screenrecord-update-stream', this.combinedStream)
    }


}

module.exports = StreamCapturer;