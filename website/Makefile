PYTHON := python3  # Use python3 if that's the version you have

all: clean
	$(PYTHON) generate.py
	cd ../docs; make html
	pwd
	cp -a ../docs/build/html build/docs
	cp build/docs/_static/fonts/RobotoSlab/roboto-slab-v7-regular.eot build/docs/_static/fonts/RobotoSlab/roboto-slab.eot
	cp -a static build/
	$(PYTHON) postprocess_docs.py

clean:
	rm -rf build/*
