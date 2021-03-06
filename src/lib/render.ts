import Body from "./body"
import Wireframe from "./wireframe"

export default class Render {

	canvas: {
		game: HTMLCanvasElement,
		text: HTMLCanvasElement
	};

	fps: {
		count: number,
		rate: number,
		last: number
	};

	gl: WebGLRenderingContext;
	canvas_2d: CanvasRenderingContext2D;
	debug: boolean;
	program: WebGLProgram;
	aspect_ratio: number;

	constructor(vertex: string, fragment: string) {
		this.canvas = {
			game: document.querySelector("#game"),
			text: document.querySelector("#text")
		};

		this.gl = this.canvas.game.getContext("webgl", { antialias: false });
		this.canvas_2d = this.canvas.text.getContext("2d");

		this.debug = false;

		this.fps = {
			count: 0,
			last: Date.now(),
			rate: 0
		};

		if (!this.gl || !this.canvas_2d)
			throw new Error("Unsupported browser");

		const shaders = [
			compile(this.gl, this.gl.VERTEX_SHADER, vertex),
			compile(this.gl, this.gl.FRAGMENT_SHADER, fragment)
		];

		this.program = link(this.gl, shaders);
		this.gl.useProgram(this.program);
		this.gl.clearColor(0, 0, 0, 1);

		this.resize()
		this.canvas.game.addEventListener("webkitfullscreenchange", this.resize.bind(this));

		// document.querySelector('#fullscreen').addEventListener('click', this.fullscreen.bind(this));

		window.addEventListener("resize", this.resize.bind(this));
	}

	clear(): void {
		const now = Date.now();

		if (now - this.fps.last < 1000) {
			this.fps.count++;
		} else {
			this.fps.rate = this.fps.count / 1;
			this.fps.count = 0;
			this.fps.last = now;
		}

		this.gl.clear(this.gl.COLOR_BUFFER_BIT);
		this.canvas_2d.clearRect(0, 0, this.canvas.text.clientWidth, this.canvas.text.clientHeight);

		if (this.debug) {
			this._grid();
			this._text(0, 0.9, `${this.fps.rate} FPS`, "#fff");
		}
	}

	_grid(): void {
		for (let y = -1; y < 1; y += 0.1)
			this.line(0, y, Math.PI, [0.25, 0.25, 0.25, 1]);

		for (let x = -this.aspect_ratio; x < this.aspect_ratio; x += 0.1)
			this.line(x, 0, Math.PI / 2, [0.25, 0.25, 0.25, 1]);
	}

	draw(wireframe: Wireframe, position: number[], rotation: number, size: number): void {
		attribute(this.gl, this.program, "a_vertex", wireframe.shape, 2);

		uniform(this.gl, this.program, "u_color", wireframe.color);
		uniform(this.gl, this.program, "u_position", position);
		uniform(this.gl, this.program, "u_rotation", rotation);
		uniform(this.gl, this.program, "u_size", size);

		// move this to resize?
		uniform(this.gl, this.program, "u_aspect_ratio", this.aspect_ratio);

		this.gl.drawArrays(this.gl.LINE_STRIP, 0, wireframe.shape.length / 2);
	}

	drawBody(body: Body): void {
		this.draw(body.wireframe, body.position, body.rotation, body.size);

		if (this.debug) {
			this.polygon(body.wireframe.bounds, 8, body.position, body.rotation, [0, 1, 0, 1]);

			const px = body.position[0];
			const py = body.position[1];
			const vx = body.velocity[0];
			const vy = body.velocity[1];

			this._text(px + 0.1, py - 0.1, `b ${body.wireframe.bounds}`);
			this._text(px + 0.1, py - 0.2, `p { x: ${px.toFixed(3)}, y: ${py.toFixed(3)} }`);
			this._text(px + 0.1, py - 0.3, `v { x: ${vx.toFixed(3)}, y: ${vy.toFixed(3)} }`);
			this._text(px + 0.1, py - 0.4, `r ${body.rotation.toFixed(3)}`);
		}
	}

	_text(x: number, y: number, text: string, color?: string, font?: string): void {
		const w = this.canvas.text.clientWidth / 2;
		const h = this.canvas.text.clientHeight / 2;

		this.canvas_2d.save();
		this.canvas_2d.font = font || "normal 16px Helvetica";

		const m = this.canvas_2d.measureText(text);

		this.canvas_2d.fillStyle = color || "#0f0";
		this.canvas_2d.translate(w - (m.width / 2), h);
		this.canvas_2d.fillText(text, (x * w / this.aspect_ratio), y * -h);
		this.canvas_2d.restore();
	}

	line(x: number, y: number, rotation: number, color: number[]): void {
		const position = [x, y];

		const c = Math.cos(rotation) * this.aspect_ratio;
		const s = Math.sin(rotation);

		const wireframe: Wireframe = {
			bounds: 0,
			color: color.concat(color),
			shape: [-c, -s, c, s]
		};

		const size = 1;

		this.draw(wireframe, position, rotation, size);
	}

	polygon(radius: number, sides: number, position: number[], rotation: number, color: number[]): void {
		const wireframe: Wireframe = {
			bounds: 0,
			color: [],
			shape: []
		};

		for (let r = 0; r <= Math.PI * 2; r += Math.PI * 2 / sides) {
			wireframe.shape.push(Math.cos(r) * radius);
			wireframe.shape.push(Math.sin(r) * radius);
			wireframe.color = wireframe.color.concat(color);
		}

		const size = 1;

		this.draw(wireframe, position, rotation, size);
	}

	resize(): void {
		this.canvas.game.width = this.canvas.text.width = document.body.clientWidth;
		this.canvas.game.height = this.canvas.text.height = document.body.clientHeight;

		this.gl.viewport(0, 0, this.canvas.game.clientWidth, this.canvas.game.clientHeight);

		this.aspect_ratio = this.canvas.game.clientWidth / this.canvas.game.clientHeight;
	}

	fullscreen(): void {
		this.canvas.game.webkitRequestFullScreen();
	}

}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader);

		gl.deleteShader(shader);

		throw new Error(`Failed to compile shader: ${info}`);
	}

	return shader;
}

function link(gl: WebGLRenderingContext, shaders: WebGLShader[]): WebGLProgram {
	const program = gl.createProgram();

	shaders.forEach((shader) => gl.attachShader(program, shader));
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(program);

		gl.deleteProgram(program);

		throw new Error(`Failed to link program: ${info}`);
	}

	return program;
}

function attribute(gl: WebGLRenderingContext, program: WebGLProgram, key: string, value: number[], size: number): void {
	const buffer = gl.createBuffer();
	const location = gl.getAttribLocation(program, key);

	if (!~location)
		throw new Error(`Failed to get attribute location "${key}"`);

	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(value), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(location);
	gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

function uniform(gl: WebGLRenderingContext, program: WebGLProgram, key: string, value: number | number[]): void {
	const location = gl.getUniformLocation(program, key);

	if (!location)
		throw new Error(`Failed to get uniform location "${key}"`);

	if (Array.isArray(value)) {
		switch (value.length) {
			case 2:
				gl.uniform2fv(location, new Float32Array(value));
				break;
			case 4:
				gl.uniform4fv(location, new Float32Array(value));
				break;
			default:
				gl.uniformMatrix3fv(location, false, new Float32Array(value));
		}
	} else {
		gl.uniform1f(location, value);
	}
}
