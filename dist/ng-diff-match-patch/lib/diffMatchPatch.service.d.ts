import { OnInit } from '@angular/core';
import { DiffMatchPatch } from './diffMatchPatch';
import * as i0 from "@angular/core";
export declare class DiffMatchPatchService implements OnInit {
    private dmp;
    constructor(dmp: DiffMatchPatch);
    ngOnInit(): void;
    getDiff(left: string, right: string): import("./diffMatchPatch").Diff[];
    getSemanticDiff(left: string, right: string): import("./diffMatchPatch").Diff[];
    getProcessingDiff(left: string, right: string): import("./diffMatchPatch").Diff[];
    getLineDiff(left: string, right: string): import("./diffMatchPatch").Diff[];
    getDmp(): DiffMatchPatch;
    static ɵfac: i0.ɵɵFactoryDeclaration<DiffMatchPatchService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<DiffMatchPatchService>;
}
