const path = require('path');
const { task, src, dest } = require('gulp');

task('build:icons', copyIcons);

function copyIcons() {
	const nodeSource = path.resolve('nodes', '**', '*.{png,svg}');
	const nodeDestination = path.resolve('dist', 'nodes');

	// encoding: false 를 줘서 바이너리 깨짐 방지
	return src(nodeSource, { encoding: false }).pipe(dest(nodeDestination));
}
