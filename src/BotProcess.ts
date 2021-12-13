import { ChildProcess, fork } from 'child_process';
import path from 'path'

import tomcat from '@gostarehnegar/tomcat';
import fs from 'fs-extra';

type ILogger = tomcat.Infrastructure.Base.ILogger

export class BotProcess {
    public id: string;
    public workspace: string;
    public src: string;
    private logger: ILogger;
    private process: ChildProcess = null;
    public name: string;
    public indexJs: string;
    constructor(public _path) {
        const p = path.parse(this._path);
        (p);
        const parsed = path.parse(this._path).dir.split('/')
        this.name = parsed[parsed.length - 1]
        this.id = this.name + Date.now();
        this.workspace = `./workspace/${this.name}/${this.id}`
        this.src = path.parse(this._path).dir
        this.indexJs = _path
        this.logger = tomcat.Domain.Base.Utils.instance.getLogger(this.name);
    }

    public get Process() {
        return this.process
    }
    // public get indexJs() {
    //     return this.src;
    // }

    public async prepareWorkspace(): Promise<boolean> {
        let result = false;
        try {
            if (!(await fs.existsSync(this.workspace))) {
                fs.mkdirSync(this.workspace, { recursive: true })
            }
            if (!(await fs.existsSync(this.src))) {
                throw `Not found at ${this.src}`;
            }
            await fs.copy(this.src, this.workspace);

            const docker_compose = (await fs.readFile('./templates/docker-compose.yml'))
                .toString();
            docker_compose.replace('BOT_IMAGE_NAME', this.id);
            await fs.writeFile(`${this.workspace}/docker-compose.yml`,
                docker_compose.replace('BOT_IMAGE_NAME', this.id));
            const docker_file = (await fs.readFile('./templates/Dockerfile'))
                .toString();
            await fs.writeFile(`${this.workspace}/Dockerfile`, docker_file);
            const docker_ignore = (await fs.readFile('./templates/.dockerignore'))
                .toString();
            await fs.writeFile(`${this.workspace}/.dockerignore`, docker_ignore);
            const package_json = (await fs.readFile('./templates/package.json'))
                .toString();
            await fs.writeFile(`${this.workspace}/package.json`, package_json);
            result = true;
        }
        catch (err) {
            this.logger.error(
                `An error occured while trying to prepare this workspace: ${this.workspace} , Err:${err}`);
        }
        return result;
    }
    public async ensureWorkspace(repair = true) {
        let result = fs.existsSync(this.workspace)
            && fs.existsSync(this.src)
            && fs.existsSync(this.indexJs);
        if (!result && repair) {
            result = await this.prepareWorkspace() && await this.ensureWorkspace(false)
        }
        return result;
    }
    public async Start(config: unknown, args: string[] = null): Promise<boolean> {
        (args)
        let result = false;
        // eslint-disable-next-line no-useless-catch
        try {
            result = await this.ensureWorkspace(true);
            if (!result)
                throw `Failed to create workspace for this bot: ${this.name}`;
            // await fs.writeFile(this.src + "/config.json", JSON.stringify(config));
            config["id"] = this.id
            await fs.writeFile(this.workspace + "/config.json", JSON.stringify(config));
            const fullPath = path.resolve(this.workspace + "/config.json");
            this.process = fork(this.indexJs, ["config", fullPath]);
        }
        catch (err) {

            throw err;

        }

        return result;

    }
}