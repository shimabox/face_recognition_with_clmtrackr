document.addEventListener('DOMContentLoaded', function () {
    /**
     |--------------------------------------------------------------------------
     | params
     |--------------------------------------------------------------------------
     */
    // video canvas size(4:3)
    const video_canvas_w = 640; // default 640
    const video_canvas_h = Math.round(video_canvas_w * (3 / 4)); // default 480

    // 顔画像キャプチャー先canvasのサイズ係数
    const cliped_size_factor = 1.0;

    /**
     |--------------------------------------------------------------------------
     | 前処理
     |--------------------------------------------------------------------------
     */
    let ctracker = new clm.tracker();

    // video
    let video    = document.getElementById('camera');
    video.width  = video_canvas_w;
    video.height = video_canvas_h;

    // canvas
    let video_canvas     = document.getElementById('from-video');
    let video_canvas_ctx = video_canvas.getContext('2d');
    video_canvas.width   = video_canvas_w;
    video_canvas.height  = video_canvas_h;

    let cliped_canvas     = document.getElementById('cliped');
    let cliped_canvas_ctx = cliped_canvas.getContext('2d');

    let dummy_canvas     = document.getElementById('dummy');
    let dummy_canvas_ctx = dummy_canvas.getContext('2d');

    // dummy wrapper
    let dummy_box = document.getElementById('dummy-box');

    // video constraints
    const video_constraints_for_front = {video: {facingMode : "user"}};
    const video_constraints_for_rear  = {video: {facingMode : {exact : "environment"}}};
    let video_track = null;

    // カメラ切り替え
    const facing_mode = document.getElementById('facing-mode');
    let is_front = facing_mode.value !== "0";
    facing_mode.addEventListener('change', function(e){
        is_front = this.checked;

        if (video_track) {
            video_track.stop();
        }

        video_track = null;
        video.srcObject = null;

        // Reload video
        load();
    });

    // グレースケール変換
    const for_grayscale = document.getElementById('to-grayscale');
    let switch_grayscale = for_grayscale.value !== "0";
    for_grayscale.addEventListener('change', function(e){
        switch_grayscale = this.checked;
    });

    // debug用
    const for_debug = document.getElementById('debug');
    let is_debug = for_debug.value !== "0";
    for_debug.addEventListener('change', function(e){
        is_debug = this.checked;
    });

    // 顔部分のマージン設定
    let scale; // 顔の長さを10等分する場合 1/10, 5等分の場合 1/5,,,
    let margin_of_top_scale; // 顔部分の何%分上にマージンを取るか(margin_of_bottom_scaleとの調整が必要)
    let margin_of_bottom_scale; // 顔部分の何%分下にマージンを取るか(margin_of_top_scaleとの調整が必要)
    let margin_of_left_scale; // 顔部分の何%分左にマージンを取るか(margin_of_right_scaleとの調整が必要)
    let margin_of_right_scale; // 顔部分の何%分右にマージンを取るか(margin_of_left_scaleとの調整が必要)

    // @lenk https://beiznotes.org/input-range-show-value/
    // スライダーの値
    const range_elem = document.getElementsByClassName('range');

    const apply_range_val = function(elem, target) {
        return function(evt) {
            setting_face_margin(elem.id);
            apply_scale_val(elem.id, elem.value);
            target.innerHTML = calc_range_val(elem.id, elem.value);
        }
    }

    function calc_range_val(id_name, value) {
        if (id_name !== 'scale') {
            return value;
        }

        const _scale = parseInt(value, 10);
        if (_scale <= 0) {
            return 0;
        }
        return Math.round( (1 / _scale) * 1000 ) / 10;
    }

    function apply_scale_val(id_name, value) {
        if (id_name !== 'scale') {
            return;
        }

        document.getElementById('scale-val').innerHTML = value;
    }

    function setting_face_margin(id_name) {
        if (id_name === 'scale') {
            const _scale = parseInt(document.getElementById(id_name).value, 10);
            scale = _scale > 0 ? 1 / _scale : 0;
        }

        // @link https://blog.sushi.money/entry/2017/04/19/114028
        Array.from(range_elem, function(range) {
            const bar = range.querySelector('input');
            switch (bar.id) {
                case 'margin_of_top_scale':
                    margin_of_top_scale = scale * bar.value;
                    break;
                case 'margin_of_bottom_scale':
                    margin_of_bottom_scale = scale * bar.value;
                    break;
                case 'margin_of_left_scale':
                    margin_of_left_scale = scale * bar.value;
                    break;
                case 'margin_of_right_scale':
                    margin_of_right_scale = scale * bar.value;
                    break;
            }
        });
    }

    // transform: scaleX(-1); により逆転する
    function switch_margin_label() {
        const l = document.getElementById('range-margin-left');
        const r = document.getElementById('range-margin-right');
        if (is_front === true) {
            l.innerHTML = 'margin-right';
            r.innerHTML = 'margin-left';
        } else {
            l.innerHTML = 'margin-left';
            r.innerHTML = 'margin-right';
        }
    }

    function init_face_margin() {
        setting_face_margin('scale');

        for(let i = 0, len = range_elem.length; i < len; i++){
            let range = range_elem[i];
            let bar = range.querySelector('input');
            let target = range.querySelector('span > span.range-val');
            bar.addEventListener('input', apply_range_val(bar, target));
            apply_scale_val(bar.id, bar.value);
            target.innerHTML = calc_range_val(bar.id, bar.value);
        }
    }

    /**
     |--------------------------------------------------------------------------
     | start
     |--------------------------------------------------------------------------
     */

    init_face_margin();

    // Load video
    load();

    function load() {
        const constraints = is_front ? video_constraints_for_front : video_constraints_for_rear;

        swith_scaleX();
        switch_margin_label();

        navigator.mediaDevices.getUserMedia(constraints)
        .then(load_success)
        .catch(load_fail);
    }

    function load_success(stream) {
        video_track = stream.getVideoTracks()[0];
        video.srcObject = stream;
    }

    function load_fail(err) {
        alert(err);
        console.log(err);
    }

    function swith_scaleX() {
        const scale_x_val = is_front ? -1 : 1;
        video_canvas.style.transform  = `scaleX(${scale_x_val})`;
        cliped_canvas.style.transform = `scaleX(${scale_x_val})`;
        dummy_canvas.style.transform  = `scaleX(${scale_x_val})`;
    }

    // 動画再生のイベント監視
    let tracking_started = false;
    video.addEventListener('playing', function(){
        if (tracking_started === true) {
            return;
        }

        adjust_proportions();
        init_ctracker();
        draw_loop();

        video.onresize = function() {
            adjust_proportions();
            ctracker.stop();
            ctracker.reset();
            ctracker.start(video);
        }

        tracking_started = true;
    });

    function init_ctracker() {
        ctracker.init();
        ctracker.start(video);
    }

    function adjust_proportions() {
        // resize overlay and video if proportions of video are not 4:3
        // keep same height, just change width
        const proportion = video.videoWidth / video.videoHeight;
        const video_width = Math.round(video.height * proportion);

        video.width = video_width;
        video_canvas.width = video_width;
        dummy_canvas.width = video_width;
    }

    function draw_loop() {
        requestAnimationFrame(draw_loop);

        let w = video_canvas.width;
        let h = video_canvas.height;
        video_canvas_ctx.clearRect(0, 0, w, h);
        video_canvas_ctx.drawImage(video, 0, 0, w, h);

        dummy_canvas.width = w;
        dummy_canvas.height = h;
        dummy_canvas_ctx.clearRect(0, 0, w, h);
        dummy_canvas_ctx.drawImage(video, 0, 0, w, h);

        ctracker.draw(video_canvas);

        const positions = ctracker.getCurrentPosition();
        if (positions !== false) {
            render_cliped_canvas(positions);
        } else {
            clear_cliped_canvas();
        }

        _stats();
    }

    /**
     * render cliped_canvas
     */
    function render_cliped_canvas(p) {
        // 顔領域の矩形座標を求める
        // @link http://blog.phalusamil.com/entry/2016/07/09/150751
        const index_of_min_x = [0, 1, 2, 3, 4, 5, 6, 7, 19, 20];
        const index_of_min_y = [0, 1, 2, 12, 13, 14, 15, 16, 19, 20];
        const index_of_max_x = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        const index_of_max_y = [3, 4, 5, 6, 7, 8, 9, 10, 11];

        let min = {'x': 100000, 'y': 100000};
        let max = {'x': 0, 'y': 0};

        for (let i = 0; i < index_of_min_x.length; i++) {
            let k = index_of_min_x[i];
            min.x = min.x > p[k][0] ? p[k][0] : min.x;
        }
        for (let i = 0; i < index_of_min_y.length; i++) {
            let k = index_of_min_y[i];
            min.y = min.y > p[k][1] ? p[k][1] : min.y;
        }
        for (let i = 0; i < index_of_max_x.length; i++) {
            let k = index_of_max_x[i];
            max.x = max.x < p[k][0] ? p[k][0] : max.x;
        }
        for (let i = 0; i < index_of_max_y.length; i++) {
            let k = index_of_max_y[i];
            max.y = max.y < p[k][1] ? p[k][1] : max.y;
        }

        const min_x  = Math.round(min.x);
        const min_y  = Math.round(min.y);
        const max_x  = Math.round(max.x);
        const max_y  = Math.round(max.y);

        const face_w = max.x - min.x;
        const face_h = max.y - min.y;

        const face_margin = Math.round(face_h * scale);

        // 顔検出部分の面積調整(少し広めにしたりとか)
        // transform: scaleX(-1); している場合sxとswの関係性が逆転します
        let sx = min_x  - (face_w * margin_of_left_scale);
        let sy = min_y  - (face_h * margin_of_top_scale);
        let sw = face_w + (face_w * margin_of_right_scale);
        let sh = face_h + (face_h * margin_of_bottom_scale);

        const vcw = video_canvas.width;
        const vch = video_canvas.height;

        // 画面上に顔切り取り部分が見切れた場合
        if (sy < 0) {
            sy += Math.abs(sy);
        }

        // 画面下に顔切り取り部分が見切れた場合
        const assigned_margin_bottom = Math.round((margin_of_bottom_scale - margin_of_top_scale) * 10);
        const margin_of_bottom       = face_margin * assigned_margin_bottom;
        if (max_y + margin_of_bottom > vch) {
            sy -= (max_y + margin_of_bottom) - vch;
        }

        // 画面左に顔切り取り部分が見切れた場合
        const assigned_margin_left = Math.round((margin_of_right_scale - margin_of_left_scale) * 10);
        const margin_of_left       = face_margin * assigned_margin_left;
        if (max_x + margin_of_left > vcw) {
            sx -= (max_x + margin_of_left) - vcw;
        }

        // 画面右に顔切り取り部分が見切れた場合
        if (sx < 0) {
            sx += Math.abs(sx);
        }

        // 顔が見切れた場合
        if (max_x > vcw || max_y > vch || min_x < 0 || min_y < 0) {
            // clear_cliped_canvas();
            return;
        }

        const w = Math.round(sw * cliped_size_factor);
        const h = Math.round(sh * cliped_size_factor);

        cliped_canvas.width  = w;
        cliped_canvas.height = h;
        cliped_canvas_ctx.clearRect(0, 0, w, h);
        cliped_canvas_ctx.drawImage(
            dummy_canvas,
            Math.round(sx),
            Math.round(sy),
            Math.round(sw),
            Math.round(sh),
            0,
            0,
            w,
            h
        );

        if (switch_grayscale === true) {
            to_grayscale(cliped_canvas, cliped_canvas_ctx);
        }

        // -- debug --
        if (is_debug === true) {
            if (scale <= 0) {
                render_debug(dummy_canvas_ctx, 'rgba(0, 255, 0, 1)', min_x, min_y, face_w, face_h);
                after_render_debug();
                return;
            }

            // -- 顔部分マージン付き --
            for (let margin=0, _sh=sh;_sh>=0;_sh-=face_h * scale) {
                render_debug(dummy_canvas_ctx, 'rgba(255, 0, 0, 1)', sx, sy, sw, sh - margin);
                margin += face_h * scale;
            }

            // -- 顔部分 --
            for (let _scale=0;_scale<=1.0;_scale+=scale) {
                render_debug(dummy_canvas_ctx, 'rgba(0, 255, 0, 1)', min_x, min_y, face_w, face_h - (face_h * _scale));
            }

            after_render_debug();

        } else {
            dummy_box.style.display = 'none';
        }
    }

    function render_debug(ctx, ss, x, y, w, h) {
        ctx.beginPath();
        ctx.strokeStyle = ss;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        ctx.stroke();
    }
    function after_render_debug() {
        dummy_box.style.display = 'block';
    }

    /**
     * グレースケール変換
     * @link https://www.html5canvastutorials.com/advanced/html5-canvas-grayscale-image-colors-tutorial/
     */
    function to_grayscale(canvas, context) {
        let image_data = context.getImageData(0, 0, canvas.width, canvas.height);
        let data = image_data.data;

        for(let i = 0; i < data.length; i += 4) {
          let brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
          // red
          data[i] = brightness;
          // green
          data[i + 1] = brightness;
          // blue
          data[i + 2] = brightness;
        }

        // overwrite original image
        context.putImageData(image_data, 0, 0);
    }

    /**
     * clear cliped_canvas
     */
    function clear_cliped_canvas() {
        cliped_canvas.width  = 0;
        cliped_canvas.height = 0;
        cliped_canvas_ctx.clearRect(0, 0, cliped_canvas.width, cliped_canvas.height);
    }

    /******** stats ********/
    function _stats() {
        body.dispatchEvent(event);
    }
    const body = document.querySelector('body');
    // Create the event.
    const event = document.createEvent('Event');
    // Define that the event name is 'build'.
    event.initEvent('draw_loop', true, true);

    const stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    body.appendChild(stats.domElement);

    // Update stats on every iteration.
    document.addEventListener('draw_loop', function(event) {
        stats.update();
    }, false);
});
