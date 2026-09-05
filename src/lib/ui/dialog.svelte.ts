type DialogRequest =
	| {
			kind: 'prompt';
			message: string;
			resolve: (value: string | null) => void;
	  }
	| {
			kind: 'confirm';
			message: string;
			resolve: (value: boolean) => void;
	  };

class DialogState {
	current = $state<DialogRequest | null>(null);
	inputValue = $state('');
	generation = $state(0);

	confirm(message: string): Promise<boolean> {
		this.cancel();
		this.inputValue = '';
		this.generation += 1;
		return new Promise((resolve) => {
			this.current = { kind: 'confirm', message, resolve };
		});
	}

	prompt(message: string, initial = ''): Promise<string | null> {
		this.cancel();
		this.inputValue = initial;
		this.generation += 1;
		return new Promise((resolve) => {
			this.current = { kind: 'prompt', message, resolve };
		});
	}

	cancel(): void {
		const open = this.current;
		if (!open) {
			return;
		}
		this.current = null;
		switch (open.kind) {
			case 'prompt':
				open.resolve(null);
				return;
			case 'confirm':
				open.resolve(false);
				return;
			default: {
				const _exhaustive: never = open;
				return _exhaustive;
			}
		}
	}

	submit(): void {
		const open = this.current;
		if (!open) {
			return;
		}
		this.current = null;
		switch (open.kind) {
			case 'prompt':
				open.resolve(this.inputValue);
				return;
			case 'confirm':
				open.resolve(true);
				return;
			default: {
				const _exhaustive: never = open;
				return _exhaustive;
			}
		}
	}
}

export const appDialog = new DialogState();
